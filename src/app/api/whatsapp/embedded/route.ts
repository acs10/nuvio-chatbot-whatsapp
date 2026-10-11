import { handle, json, readJson, sameOrigin, sessionActor, stateResponse } from "@/modules/server/api";
import { readData } from "@/modules/server/platform-service";
import { waConfig } from "@/modules/whatsapp/cloud-api";
import { connectEmbedded } from "@/modules/whatsapp/whatsapp-service";

/** Volta do cadastro incorporado da Meta: { code, wabaId, phoneNumberId }. */
export async function POST(req: Request) {
  return handle("wa-embedded", async () => {
    if (!sameOrigin(req)) return json({ error: "Origem não permitida." }, 403);
    if (!waConfig().embedded) return json({ error: "Cadastro incorporado não configurado (META_APP_ID, META_APP_SECRET e META_CONFIG_ID)." }, 404);
    const actor = await sessionActor(await readData());
    if (actor?.role !== "client" || !actor.workspaceId) return json({ error: "Entre como cliente." }, 401);
    const b = (await readJson(req)) ?? {};
    const code = String(b.code ?? "").slice(0, 1000);
    const wabaId = String(b.wabaId ?? "").replace(/\D/g, "").slice(0, 30);
    const phoneNumberId = String(b.phoneNumberId ?? "").replace(/\D/g, "").slice(0, 30);
    if (!code || !wabaId || !phoneNumberId) return json({ error: "Dados incompletos devolvidos pela Meta. Tente novamente." }, 422);
    const err = await connectEmbedded(actor.workspaceId, { code, wabaId, phoneNumberId });
    if (err) return json({ error: err }, 422);
    return stateResponse(await readData(), actor);
  });
}
