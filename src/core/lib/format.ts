export { newId } from "./ids";

const TZ = "America/Sao_Paulo";

/** "AAAA-MM-DD" no horário de Brasília. */
export const dayKey = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
export const todayKey = () => dayKey();

/** Soma dias a "AAAA-MM-DD". */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const formatDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });
export const formatLongDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const formatDateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: TZ });
export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
export const formatMonth = (month: string) => new Date(`${month}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });
export const formatPrice = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const formatNumber = (value: number) => value.toLocaleString("pt-BR");
export const formatPercent = (value: number, digits = 1) => `${(value * 100).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

/** "agora", "8 min", "2 h", "3 d" */
export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (min < 1) return "Agora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "+55 11 98765-4321" enquanto digita (DDI 55 + DDD + número). */
export function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").replace(/^55/, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `+55 ${d}`;
  if (d.length <= 7) return `+55 ${d.slice(0, 2)} ${d.slice(2)}`;
  return `+55 ${d.slice(0, 2)} ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

/** "5563981112233" (formato do WhatsApp) → "+55 63 98111-2233". */
export function formatWhatsAppPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return `+55 ${d.slice(2, 4)} ${d.slice(4, d.length - 4)}-${d.slice(-4)}`;
  return d ? `+${d}` : "";
}

/** SHA-256 com sal fixo (demonstração; no backend: scrypt no servidor). */
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`nuvio:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
