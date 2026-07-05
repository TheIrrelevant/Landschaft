/*
 * type: app-source
 * description: MCP server exposing Landschaft planning editor terrain and map tools.
 * last-updated: 2026-07-04
 * last-model: codex-gpt-5
 * last-change: add Ollama model listing and LCA provider routing
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadLocalEnvFiles } from "./loadEnv.js";
import {
  CodedAreaSchema,
  generateTerrainProjectAsync,
  TerrainGenerationRequestSchema
} from "@landschaft/shared";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleLcaAnalyze, handleLcaListModels } from "./lcaTools.js";
import { handleMapRead, handleMapWriteDraft } from "./mapTools.js";
import {
  handleSafeDatasetImport,
  handleSafeDatasetManifest,
  handleSafeDatasetSearch
} from "./safeDatasetTools.js";

loadLocalEnvFiles();

const server = new McpServer({
  name: "landschaft",
  version: "0.1.0"
});
const httpPort = Number(process.env.LANDSCHAFT_MCP_HTTP_PORT ?? 8787);

const SafeDatasetIdSchema = z.enum([
  "naip-ortho",
  "dem-3dep",
  "usgs-contours",
  "hydrography",
  "transportation",
  "soil",
  "land-cover",
  "structures",
  "buildings",
  "boundaries",
  "woodland"
]);

server.tool(
  "terrain_generate",
  "Generate project metadata, a heightmap terrain model, and base layers from orthophoto corner coordinates.",
  TerrainGenerationRequestSchema.shape,
  async (request) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await generateTerrainProjectAsync(request), null, 2)
      }
    ]
  })
);

server.tool(
  "map_read",
  "Read selected landscape map layers as structured vector evidence for LLM analysis.",
  {
    projectId: z.string(),
    selectedLayerIds: z.array(z.string()),
    extentAreaId: z.string().optional(),
    geometryDetail: z.enum(["summary", "simplified", "full"]).default("summary"),
    projectSnapshot: z.string().optional()
  },
  async ({ projectId, selectedLayerIds, extentAreaId, geometryDetail, projectSnapshot }) => {
    try {
      const result = handleMapRead(
        {
          projectId,
          selectedLayerIds,
          extentAreaId,
          geometryDetail
        },
        projectSnapshot
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error:
                  error instanceof Error ? error.message : "map_read failed."
              },
              null,
              2
            )
          }
        ],
        isError: true
      };
    }
  }
);

server.tool(
  "map_write_draft",
  "Write validated draft planning features back into the Landschaft map model.",
  {
    projectId: z.string(),
    targetLayerId: z.string().optional(),
    createLayerName: z.string().optional(),
    reason: z.string(),
    projectSnapshot: z.string().optional(),
    features: z.array(CodedAreaSchema)
  },
  async ({
    projectId,
    targetLayerId,
    createLayerName,
    reason,
    projectSnapshot,
    features
  }) => {
    try {
      const result = handleMapWriteDraft(
        {
          projectId,
          targetLayerId,
          createLayerName,
          reason,
          features
        },
        projectSnapshot
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error:
                  error instanceof Error ? error.message : "map_write_draft failed."
              },
              null,
              2
            )
          }
        ],
        isError: true
      };
    }
  }
);

server.tool(
  "lca_analyze",
  "Analyze selected map layers with Ollama and return a draft Landscape Character Assessment layer.",
  {
    projectId: z.string(),
    selectedLayerIds: z.array(z.string()),
    extentAreaId: z.string().optional(),
    geometryDetail: z.enum(["summary", "simplified", "full"]).default("simplified"),
    purpose: z.string(),
    analysisMode: z
      .enum(["desk-study", "field-validation", "classification"])
      .default("desk-study"),
    outputQuality: z
      .enum(["conceptual", "professional", "report-ready"])
      .default("professional"),
    model: z.string().optional(),
    provider: z.literal("ollama-cloud").default("ollama-cloud"),
    dryRun: z.boolean().default(false),
    projectSnapshot: z.string().optional()
  },
  async ({
    projectId,
    selectedLayerIds,
    extentAreaId,
    geometryDetail,
    purpose,
    analysisMode,
    outputQuality,
    model,
    provider,
    dryRun,
    projectSnapshot
  }) => {
    try {
      const result = await handleLcaAnalyze(
        {
          projectId,
          selectedLayerIds,
          extentAreaId,
          geometryDetail,
          purpose,
          analysisMode,
          outputQuality,
          model,
          provider,
          dryRun
        },
        projectSnapshot
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error:
                  error instanceof Error ? error.message : "lca_analyze failed."
              },
              null,
              2
            )
          }
        ],
        isError: true
      };
    }
  }
);

server.tool(
  "safe_dataset_search",
  "Search curated safe dataset locations that have reliable provider coverage.",
  {
    query: z.string().default("")
  },
  async ({ query }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(handleSafeDatasetSearch(query), null, 2)
      }
    ]
  })
);

server.tool(
  "safe_dataset_manifest",
  "Fetch a live provider manifest for a safe location and selected datasets.",
  {
    locationId: z.string(),
    datasetIds: z.array(SafeDatasetIdSchema).optional()
  },
  async ({ locationId, datasetIds }) => {
    try {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              await handleSafeDatasetManifest(locationId, datasetIds),
              null,
              2
            )
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error:
                  error instanceof Error
                    ? error.message
                    : "safe_dataset_manifest failed."
              },
              null,
              2
            )
          }
        ],
        isError: true
      };
    }
  }
);

server.tool(
  "safe_dataset_import",
  "Import a USA safe-location dataset through live USGS and NAIP provider APIs.",
  {
    locationId: z.string(),
    datasetIds: z.array(SafeDatasetIdSchema).optional(),
    persistAssets: z.boolean().default(true)
  },
  async ({ locationId, datasetIds, persistAssets }) => {
    try {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              await handleSafeDatasetImport(locationId, datasetIds, {
                persistAssets
              }),
              null,
              2
            )
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error:
                  error instanceof Error
                    ? error.message
                    : "safe_dataset_import failed."
              },
              null,
              2
            )
          }
        ],
        isError: true
      };
    }
  }
);

server.tool(
  "start_planning_workflow",
  "Start the area-focused planning workflow for a coded LCA area.",
  {
    projectId: z.string(),
    codedAreaId: z.string()
  },
  async ({ projectId, codedAreaId }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            projectId,
            codedAreaId,
            workflow: "planning-workflow",
            status: "ready",
            nextSteps: [
              "load-area-evidence",
              "generate-local-subzones",
              "write-draft-planning-layers",
              "human-review"
            ]
          },
          null,
          2
        )
      }
    ]
  })
);

const transport = new StdioServerTransport();
startHttpBridge();
await server.connect(transport);

function startHttpBridge() {
  const httpServer = createServer(async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "content-type");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

      if (request.method === "GET" && url.pathname === "/safe-dataset/search") {
        sendJson(response, handleSafeDatasetSearch(url.searchParams.get("query") ?? ""));
        return;
      }

      if (request.method === "POST" && url.pathname === "/safe-dataset/manifest") {
        const body = await readJsonBody(request);
        sendJson(
          response,
          await handleSafeDatasetManifest(
            String(body.locationId ?? ""),
            parseDatasetIds(body.datasetIds)
          )
        );
        return;
      }

      if (request.method === "POST" && url.pathname === "/safe-dataset/import") {
        const body = await readJsonBody(request);
        sendJson(
          response,
          await handleSafeDatasetImport(
            String(body.locationId ?? ""),
            parseDatasetIds(body.datasetIds),
            { persistAssets: body.persistAssets !== false }
          )
        );
        return;
      }

      if (request.method === "GET" && url.pathname === "/lca/models") {
        sendJson(response, await handleLcaListModels());
        return;
      }

      if (request.method === "POST" && url.pathname === "/lca/analyze") {
        const body = await readJsonBody(request);
        sendJson(
          response,
          await handleLcaAnalyze(
            {
              requestId: typeof body.requestId === "string" ? body.requestId : undefined,
              projectId: String(body.projectId ?? ""),
              selectedLayerIds: parseStringArray(body.selectedLayerIds),
              extentAreaId:
                typeof body.extentAreaId === "string" ? body.extentAreaId : undefined,
              geometryDetail: parseGeometryDetail(body.geometryDetail),
              purpose: String(body.purpose ?? ""),
              analysisMode: parseLcaAnalysisMode(body.analysisMode),
              outputQuality: parseLcaOutputQuality(body.outputQuality),
              model: typeof body.model === "string" ? body.model : undefined,
              provider: "ollama-cloud",
              dryRun: body.dryRun === true,
              knowledgeBankEntries: Array.isArray(body.knowledgeBankEntries)
                ? body.knowledgeBankEntries
                : undefined
            },
            body.projectSnapshot
          )
        );
        return;
      }

      sendJson(response, { error: "Not found." }, 404);
    } catch (error) {
      sendJson(
        response,
        {
          error:
            error instanceof Error ? error.message : "Landschaft MCP HTTP bridge failed."
        },
        500
      );
    }
  });

  httpServer.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Landschaft MCP HTTP bridge skipped: 127.0.0.1:${httpPort} is already in use.`
      );
      return;
    }

    console.error(
      `Landschaft MCP HTTP bridge failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  });

  httpServer.listen(httpPort, "127.0.0.1");
}

function sendJson(response: ServerResponse, payload: unknown, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request: IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function parseDatasetIds(value: unknown) {
  const result = z.array(SafeDatasetIdSchema).safeParse(value);
  return result.success ? result.data : undefined;
}

function parseStringArray(value: unknown) {
  const result = z.array(z.string()).safeParse(value);
  return result.success ? result.data : [];
}

function parseGeometryDetail(value: unknown) {
  const result = z.enum(["summary", "simplified", "full"]).safeParse(value);
  return result.success ? result.data : "simplified";
}

function parseLcaAnalysisMode(value: unknown) {
  if (value === "field-validation" || value === "classification") {
    return value;
  }

  return "desk-study" as const;
}

function parseLcaOutputQuality(value: unknown) {
  if (value === "conceptual" || value === "report-ready") {
    return value;
  }

  return "professional" as const;
}
