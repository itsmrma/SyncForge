#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { handleToolCall, TOOLS_DEFINITIONS } from './tools.js';
import { getResource, RESOURCES_LIST } from './resources.js';
import { getPrompt, PROMPTS_LIST } from './prompts.js';

const server = new Server(
  {
    name: 'syncforge-mcp',
    version: '3.3.1',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// Tools handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS_DEFINITIONS,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    return await handleToolCall(name, args || {});
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `SyncForge Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
});

// Resources handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: RESOURCES_LIST,
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  try {
    const res = await getResource(request.params.uri);
    return {
      contents: [res],
    };
  } catch (error) {
    throw new Error(`Failed to read resource ${request.params.uri}: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Prompts handlers
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: PROMPTS_LIST,
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  try {
    const prompt = getPrompt(request.params.name, request.params.arguments || {});
    return prompt;
  } catch (error) {
    throw new Error(`Failed to get prompt ${request.params.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('SyncForge MCP Server running on stdio (v3.3.1)\n');
}

main().catch((error) => {
  process.stderr.write(`Fatal error running SyncForge MCP Server: ${error}\n`);
  process.exit(1);
});
