import { timingSafeEqual } from "node:crypto";
import { DOCS_ACCESS_CODE } from "@/modules/docs/docs-access";
import { DOCS_HTML } from "@/modules/docs/docs-html.generated";

// Política própria desta página: permite o desenhador de diagramas (CDN jsDelivr).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join("; ");

function codeMatches(code: string): boolean {
  const a = Buffer.from(code);
  const b = Buffer.from(DOCS_ACCESS_CODE);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(_request: Request, ctx: RouteContext<"/documents/[code]">) {
  const { code } = await ctx.params;
  if (!codeMatches(code)) return new Response("Página não encontrada", { status: 404 });

  return new Response(DOCS_HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": CSP,
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Cache-Control": "private, no-store",
    },
  });
}
