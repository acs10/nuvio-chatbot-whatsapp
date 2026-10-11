import { handle, json, readJson, sameOrigin, stateResponse } from "@/modules/server/api";
import { actorOf, readData } from "@/modules/server/platform-service";
import { verifyPassword } from "@/modules/server/secrets";
import { startSession } from "@/modules/server/session";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  return handle("login", async () => {
    if (!sameOrigin(req)) return json({ error: "Origem não permitida." }, 403);
    const body = await readJson(req);
    const email = String(body?.email ?? "").trim().toLowerCase().slice(0, 120);
    const password = String(body?.password ?? "").slice(0, 200);
    const data = await readData();
    const user = data.users.find((u) => u.email === email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      await wait(800); // atrasa tentativas de adivinhar senha
      return json({ error: "E-mail ou senha incorretos." }, 401);
    }
    const actor = actorOf(data.users, user.id, data);
    if (!actor) return json({ error: "Conta suspensa. Fale com o suporte da Nuvio." }, 403);
    await startSession(user.id);
    return stateResponse(data, actor);
  });
}
