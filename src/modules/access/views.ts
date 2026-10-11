import type { PlatformData, User } from "@/modules/domain/types";

/** Perfil logado (definido pela sessão no servidor). */
export interface ViewActor {
  id: string;
  role: "client" | "admin";
  workspaceId?: string;
}

/**
 * O que cada perfil recebe do servidor. Hash de senha nunca sai do servidor; tokens do WhatsApp
 * nem fazem parte destes dados (ficam cifrados numa coleção só do servidor).
 *  - visitante: planos e regras públicas (teste grátis);
 *  - cliente: a própria empresa — conversas, base, faturas — e o próprio usuário;
 *  - backoffice: todas as empresas, faturas e usuários (sem hash); conversas não (privacidade dos
 *    clientes finais: o backoffice vê números agregados).
 */
export function viewFor(data: PlatformData, actor: ViewActor | null): PlatformData {
  const strip = (u: User): User => ({ ...u, passwordHash: "" });
  const base = { plans: data.plans, settings: data.settings, mrrHistory: [] as PlatformData["mrrHistory"] };
  if (!actor) return { ...base, workspaces: [], knowledge: [], conversations: [], invoices: [], users: [] };
  if (actor.role === "admin") {
    return { ...base, mrrHistory: data.mrrHistory, workspaces: data.workspaces, knowledge: [], conversations: [], invoices: data.invoices, users: data.users.map(strip) };
  }
  const ws = actor.workspaceId;
  return {
    ...base,
    workspaces: data.workspaces.filter((w) => w.id === ws),
    knowledge: data.knowledge.filter((k) => k.workspaceId === ws),
    conversations: data.conversations.filter((c) => c.workspaceId === ws),
    invoices: data.invoices.filter((i) => i.workspaceId === ws),
    users: data.users.filter((u) => u.id === actor.id).map(strip),
  };
}
