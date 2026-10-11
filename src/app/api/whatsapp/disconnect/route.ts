import { handle, json, sameOrigin, sessionActor, stateResponse } from "@/modules/server/api";
import { readData } from "@/modules/server/platform-service";
import { disconnect } from "@/modules/whatsapp/whatsapp-service";

/** Desconecta o número (apaga o token guardado). */
export async function POST(req: Request) {
  return handle("wa-disconnect", async () => {
    if (!sameOrigin(req)) return json({ error: "Origem não permitida." }, 403);
    const actor = await sessionActor(await readData());
    if (actor?.role !== "client" || !actor.workspaceId) return json({ error: "Entre como cliente." }, 401);
    await disconnect(actor.workspaceId);
    return stateResponse(await readData(), actor);
  });
}
