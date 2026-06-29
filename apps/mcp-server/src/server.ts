/*
 * type: app-source
 * description: MCP server exposing Landschaft planning editor terrain and map tools.
 * last-updated: 2026-06-28
 * last-model: composer
 * last-change: connect map_read and map_write_draft to shared evidence builders
 */
import {
  CodedAreaSchema,
  generateTerrainProjectAsync,
  TerrainGenerationRequestSchema
} from "@landschaft/shared";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleMapRead, handleMapWriteDraft } from "./mapTools.js";

const server = new McpServer({
  name: "landschaft",
  version: "0.1.0"
});

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
await server.connect(transport);
