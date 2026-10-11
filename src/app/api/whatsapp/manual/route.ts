import { handle, json, readJson, sameOrigin, sessionActor, stateResponse } from "@/modules/server/api";
import { readData } from "@/modules/server/platform-service";
import { waConfig } from "@/modules/whatsapp/cloud-api";
import { connectManual } from "@/modules/whatsapp/whatsapp-service";

/**
 * Conexão manual com a API do WhatsApp: id do número + token (+ id da conta, opcional).
 * Serve para o número de TESTE da Meta e para empresas que já têm um usuário do sistema.
 * O token é validado na Meta e guardado cifrado; nunca volta para o navegador.
 */
export async function POST(req: Request) {
  return handle("wa-manual", async () => {
    if (!sameOrigin(req)) return json({ error: "Origem não permitida." }, 403);
    if (!waConfig().enabled) return json({ error: "A integração com o WhatsApp ainda não foi configurada no servidor (META_APP_SECRET e WHATSAPP_VERIFY_TOKEN)." }, 404);
    const actor = await sessionActor(await readData());
    if (actor?.role !== "client" || !actor.workspaceId) return json({ error: "Entre como cliente." }, 401);
    const b = (await readJson(req)) ?? {};
    const phoneNumberId = String(b.phoneNumberId ?? "").replace(/\D/g, "").slice(0, 30);
    const wabaId = String(b.wabaId ?? "").replace(/\D/g, "").slice(0, 30);
    const token = String(b.token ?? "").trim().slice(0, 600);
    if (phoneNumberId.length < 8) return json({ error: "Informe o id do número (Phone number ID)." }, 422);
    if (token.length < 30) return json({ error: "Informe o token de acesso." }, 422);
    const err = await connectManual(actor.workspaceId, { phoneNumberId, wabaId, token });
    if (err) return json({ error: err }, 422);
    return stateResponse(await readData(), actor);
  });
}
