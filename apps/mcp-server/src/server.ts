/*
 * type: app-source
 * description: MCP server exposing Landschaft planning editor read and write tools.
 * last-updated: 2026-06-24
 * last-model: codex-gpt-5
 * last-change: added initial MCP stdio server
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "landschaft",
  version: "0.1.0"
});

server.tool(
  "map_read",
  "Read selected landscape map layers as structured vector evidence for LLM analysis.",
  {
    projectId: z.string(),
    selectedLayerIds: z.array(z.string()),
    extentAreaId: z.string().optional(),
    geometryDetail: z.enum(["summary", "simplified", "full"]).default("summary")
  },
  async ({ projectId, selectedLayerIds, extentAreaId, geometryDetail }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            projectId,
            selectedLayerIds,
            extentAreaId,
            geometryDetail,
            coordinateSystem: "project-local",
            features: [
              {
                id: "a21kd49pe2",
                layer: "lca",
                code: "23",
                meaning: "Red soil on a gentle slope with settlement-edge pressure.",
                ring: [
                  [34, 24],
                  [24, 25],
                  [20, 19],
                  [24, 35],
                  [34, 24]
                ],
                confidence: 0.74
              }
            ]
          },
          null,
          2
        )
      }
    ]
  })
);

server.tool(
  "map_write_draft",
  "Write validated draft planning features back into the Landschaft map model.",
  {
    projectId: z.string(),
    targetLayerId: z.string().optional(),
    createLayerName: z.string().optional(),
    reason: z.string(),
    features: z.array(
      z.object({
        id: z.string(),
        layer: z.string(),
        code: z.string(),
        meaning: z.string(),
        confidence: z.number().min(0).max(1),
        ring: z.array(z.tuple([z.number(), z.number()])).min(4)
      })
    )
  },
  async ({ projectId, targetLayerId, createLayerName, reason, features }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            status: "draft-written",
            projectId,
            targetLayerId,
            createLayerName,
            reason,
            featureCount: features.length,
            reviewStatus: "needs-review"
          },
          null,
          2
        )
      }
    ]
  })
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
