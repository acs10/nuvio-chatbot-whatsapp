import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sessionSecret } from "./secrets";

/**
 * Sessão de login: cookie HttpOnly assinado (HMAC-SHA256) com o id da conta e a validade.
 * O navegador não consegue ler nem forjar; a conta é conferida no banco a cada requisição
 * (conta suspensa perde o acesso na hora).
 */
const COOKIE = "nv_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

const sign = (payload: string) => createHmac("sha256", sessionSecret()).update(payload).digest("base64url");

export async function getSessionAccountId(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, exp, sig] = raw.split(".");
  if (!id || !exp || !sig) return null;
  const expected = Buffer.from(sign(`${id}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return id;
}

export async function startSession(accountId: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  (await cookies()).set(COOKIE, `${accountId}.${exp}.${sign(`${accountId}.${exp}`)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}
