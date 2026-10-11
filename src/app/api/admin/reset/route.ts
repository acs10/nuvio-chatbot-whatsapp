import { handle, json, sameOrigin, sessionActor } from "@/modules/server/api";
import { readData, resetToDemo } from "@/modules/server/platform-service";
import { endSession } from "@/modules/server/session";

/** Backoffice: apaga tudo e recria a demonstração (gasta gravações da cota do Firebase). */
export async function POST(req: Request) {
  return handle("reset", async () => {
    if (!sameOrigin(req)) return json({ error: "Origem não permitida." }, 403);
    const actor = await sessionActor(await readData());
    if (actor?.role !== "admin") return json({ error: "Apenas o backoffice pode restaurar a demonstração." }, 403);
    await resetToDemo();
    await endSession();
    return json({ ok: true });
  });
}
