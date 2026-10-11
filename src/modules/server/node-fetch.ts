import "server-only";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

/**
 * fetch mínima sobre node:http(s). O Next.js substitui o fetch global por uma
 * versão com cache que, no Netlify, trava as chamadas do Netlify Blobs; esta
 * implementação contorna isso e é passada ao SDK via getStore({ fetch }).
 */
export const nodeFetch: typeof fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init);
  const url = new URL(req.url);
  const body = req.body ? Buffer.from(await req.arrayBuffer()) : undefined;
  const send = url.protocol === "http:" ? httpRequest : httpsRequest;

  return new Promise<Response>((resolve, reject) => {
    // Tamanho explícito: sem ele o corpo vai "em pedaços" (chunked) e o armazenamento do Blobs fica lento ou expira.
    const headers = { ...Object.fromEntries(req.headers), ...(body ? { "content-length": String(body.byteLength) } : {}) };
    const outgoing = send(url, { method: req.method, headers }, (incoming) => {
      const chunks: Buffer[] = [];
      incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
      incoming.on("end", () => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(incoming.headers)) {
          if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
        const status = incoming.statusCode ?? 500;
        const noBody = status === 204 || status === 304 || req.method === "HEAD";
        resolve(new Response(noBody ? null : Buffer.concat(chunks), { status, headers }));
      });
      incoming.on("error", reject);
    });
    outgoing.on("error", reject);
    if (body) outgoing.write(body);
    outgoing.end();
  });
};
