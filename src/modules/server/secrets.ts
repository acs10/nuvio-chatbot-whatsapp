import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/**
 * Chaves do servidor (fora do banco):
 *  - SESSION_SECRET: assina o cookie de sessão;
 *  - VAULT_KEY: criptografa as senhas do cofre de acessos (AES-256-GCM).
 * Produção: variáveis do Netlify. Desenvolvimento: .env.local (criado pelo `npm run db:setup`)
 * ou, sem ele, um arquivo em .data/ gerado na primeira vez.
 */
function secret(name: "SESSION_SECRET" | "VAULT_KEY"): string {
  const fromEnv = process.env[name];
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (process.env.NODE_ENV === "production") throw new Error(`Variável ${name} ausente (configure no Netlify).`);
  const file = path.join(process.cwd(), ".data", name.toLowerCase());
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  const value = randomBytes(32).toString("base64url");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, value);
  return value;
}

export const sessionSecret = () => secret("SESSION_SECRET");
const vaultKey = () => createHash("sha256").update(secret("VAULT_KEY")).digest();

// ------------------------------------------------------------------ senhas de login

/** scrypt com sal aleatório: "scrypt$<sal>$<hash>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(password, Buffer.from(salt, "base64url"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ------------------------------------------------------------------ cofre de acessos

/** "v1:<iv>:<tag>:<cifra>" — o banco só guarda isso, nunca a senha em texto. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(":");
}

export function decryptSecret(stored: string): string {
  const [v, iv, tag, data] = stored.split(":");
  if (v !== "v1") return "";
  try {
    const decipher = createDecipheriv("aes-256-gcm", vaultKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    // chave trocada ou dado corrompido: o cliente precisa salvar a senha de novo
    return "";
  }
}
