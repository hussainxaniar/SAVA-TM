import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { resolveApiToken } from "../services/api-tokens";
import { runVia } from "./context";
import { allowRequest } from "./rate-limit";
import { buildMcpServer } from "./server";

// Section 15.3 / 15.4. `POST /api/mcp`: authenticate the Bearer token, apply the Origin check
// and the rate limit, then serve one MCP request statelessly. The Authorization header is
// never logged and error bodies never echo it.

const MAX_BODY_BYTES = 1_000_000;

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

const rpcError = (status: number, message: string, headers?: Record<string, string>) =>
  json(status, { jsonrpc: "2.0", error: { code: -32000, message }, id: null }, headers);

/** The Origin header (browsers send one; MCP clients normally don't) must be the app's own origin. */
function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return !!process.env.APP_URL && new URL(origin).origin === new URL(process.env.APP_URL).origin;
  } catch {
    return false;
  }
}

export async function handleMcpRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") return rpcError(405, "Use POST", { allow: "POST" });
  if (!originAllowed(req)) return rpcError(403, "Origin not allowed");

  const header = req.headers.get("authorization") ?? "";
  const secret = /^Bearer\s+(\S+)$/i.exec(header)?.[1];
  let token: Awaited<ReturnType<typeof resolveApiToken>> = null;
  try {
    token = secret ? await resolveApiToken(secret) : null;
  } catch (e) {
    console.error("mcp token lookup failed", e instanceof Error ? e.message : e);
    return rpcError(500, "Internal error");
  }
  if (!token) {
    return rpcError(401, "Missing or invalid API token", { "www-authenticate": 'Bearer realm="sava-tm"' });
  }
  if (!allowRequest(token.tokenId)) return rpcError(429, "Too many requests. Try again in a minute.", { "retry-after": "60" });

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return rpcError(413, "Request too large");

  const server = buildMcpServer({ userId: token.userId, spaceId: token.spaceId, scope: token.scope });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    await server.connect(transport);
    return await runVia("mcp", () => transport.handleRequest(req));
  } catch (e) {
    console.error("mcp request failed", e instanceof Error ? e.message : e);
    return rpcError(500, "Internal error");
  } finally {
    void transport.close().catch(() => {});
  }
}
