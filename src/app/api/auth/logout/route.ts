import { handle, json, sameOrigin } from "@/modules/server/api";
import { endSession } from "@/modules/server/session";

export async function POST(req: Request) {
  return handle("logout", async () => {
    if (!sameOrigin(req)) return json({ error: "Origem não permitida." }, 403);
    await endSession();
    return json({ ok: true });
  });
}
