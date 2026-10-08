import { handleMcpRequest } from "@/server/mcp/handler";

// Section 15. MCP over Streamable HTTP, stateless and JSON-only; see src/server/mcp/handler.ts.
export const dynamic = "force-dynamic";

export const POST = handleMcpRequest;
export const GET = handleMcpRequest; // answers 405
export const DELETE = handleMcpRequest; // answers 405
