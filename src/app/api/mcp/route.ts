import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateApiToken } from "@/services/api-tokens";
import { buildMcpServer } from "@/mcp/server";

// MCP HTTP transport requires runtime features (streaming, async, crypto).
// Stay on the Node.js runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized(message = "Unauthorized") {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: {
      "content-type": "application/json",
      "www-authenticate": 'Bearer realm="SaberX", error="invalid_token"'
    }
  });
}

async function authFromHeader(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  return authenticateApiToken(token);
}

async function handle(request: Request) {
  const user = await authFromHeader(request);
  if (!user) return unauthorized();

  // Stateless mode: build a fresh server + transport per request. The SDK
  // handles initialize / listTools / callTool / etc. inside one round-trip and
  // closes the transport when the response stream ends.
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true
  });
  const server = buildMcpServer(user);
  await server.connect(transport);

  try {
    return await transport.handleRequest(request);
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal MCP error"
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" }
      }
    );
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
