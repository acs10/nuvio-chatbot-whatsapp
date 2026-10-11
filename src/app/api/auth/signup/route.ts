import { TONE_LABEL, type PlanId, type Tone } from "@/modules/domain/types";
import { PlatformStore, type SignupInput } from "@/modules/platform/platform-store";
import { handle, json, readJson, sameOrigin, stateResponse } from "@/modules/server/api";
import { actorOf, mutate } from "@/modules/server/platform-service";
import { hashPassword } from "@/modules/server/secrets";
import { startSession } from "@/modules/server/session";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const PLANS: PlanId[] = ["essencial", "profissional", "escala"];

/** Cadastro: cria a empresa (teste grátis) e o usuário, e já entra. */
export async function POST(req: Request) {
  return handle("signup", async () => {
    if (!sameOrigin(req)) return json({ error: "Origem não permitida." }, 403);
    const b = (await readJson(req)) ?? {};
    const input: SignupInput = {
      company: str(b.company, 80),
      name: str(b.name, 80),
      email: str(b.email, 120),
      password: str(b.password, 200),
      segment: str(b.segment, 40),
      teamSize: str(b.teamSize, 40),
      planId: PLANS.includes(b.planId as PlanId) ? (b.planId as PlanId) : "profissional",
      assistantName: str(b.assistantName, 40),
      tone: (Object.keys(TONE_LABEL) as Tone[]).includes(b.tone as Tone) ? (b.tone as Tone) : "amigavel",
      objective: str(b.objective, 600),
      website: str(b.website, 300),
    };
    const errors = PlatformStore.validateSignup(input);
    if (Object.keys(errors).length) return json({ errors }, 422);
    const hash = await hashPassword(input.password);
    const { result, data } = await mutate(
      (s) => {
        const e = s.createAccount(input, hash);
        return Object.keys(e).length ? { errors: e } : { id: s.userId! };
      },
      { ids: Array.isArray(b.ids) ? b.ids : [], discard: (r) => "errors" in r },
    );
    if ("errors" in result) return json({ errors: result.errors }, 422);
    await startSession(result.id);
    return stateResponse(data, actorOf(data.users, result.id, data));
  });
}
