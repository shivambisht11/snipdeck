import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const raw = (env as Cloudflare.Env & { ADSENSE_PUBLISHER_ID?: string }).ADSENSE_PUBLISHER_ID || "";
    const match = /^(?:ca-)?(pub-\d{16})$/.exec(raw.trim());
    const path = new URL(request.url).pathname;
    if (path === "/ads.txt") {
      return new Response(match ? `google.com, ${match[1]}, DIRECT, f08c47fec0942fa0\n` : null, {
        status: match ? 200 : 404,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" }
      });
    }
    const response = await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    if (!match || request.method !== "GET" || !response.ok || path.startsWith("/api/") ||
        !response.headers.get("content-type")?.includes("text/html")) return response;
    const client = "ca-" + match[1];
    return new HTMLRewriter().on("head", {
      element(head) {
        head.append(`<meta name="google-adsense-account" content="${client}"><script async crossorigin="anonymous" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}"></script>`, {html: true});
      }
    }).transform(response);
  },
};

export default worker;
