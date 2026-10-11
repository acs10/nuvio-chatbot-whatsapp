import { isCommand, runCommand } from "@/modules/access/commands";
import { handle, json, readJson, sameOrigin, stateResponse } from "@/modules/server/api";
import { actorOf, mutate, readData } from "@/modules/server/platform-service";
import { getSessionAccountId } from "@/modules/server/session";
import { afterChange } from "@/modules/whatsapp/whatsapp-service";

/** Ações que mexem nas conversas: depois delas, a IA responde e as mensagens são enviadas. */
const MESSAGING = new Set(["simulateIncoming", "receiveMessage", "sendAgentMessage", "returnToBot"]);

/** Executa uma ação: { name, args, ids }. O perfil vem da sessão; a regra é a mesma da tela. */
export async function POST(req: Request) {
  return handle("command", async () => {
    if (!sameOrigin(req)) return json({ error: "Origem não permitida." }, 403);
    const body = await readJson(req);
    if (!body || !isCommand(body.name)) return json({ error: "Ação inválida." }, 400);
    const userId = await getSessionAccountId();
    const name = body.name;
    const args = Array.isArray(body.args) ? body.args : [];
    const { result, data } = await mutate(
      (s, current) => {
        const actor = actorOf(current.users, userId, current);
        return actor ? { actor, ...runCommand(s, actor, name, args, { paymentsLive: false }) } : null;
      },
      { ids: Array.isArray(body.ids) ? body.ids : [], userId, discard: (r) => !r || !!r.error },
    );
    if (!result) return json({ error: "Sua sessão terminou. Entre novamente.", me: null }, 401);
    if (result.error) return stateResponse(data, result.actor, { error: result.error }, 422);
    if (MESSAGING.has(name) && result.actor.workspaceId) {
      await afterChange(result.actor.workspaceId);
      return stateResponse(await readData(), result.actor);
    }
    return stateResponse(data, result.actor);
  });
}
