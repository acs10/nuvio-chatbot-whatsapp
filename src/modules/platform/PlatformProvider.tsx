"use client";

import { makeAutoObservable } from "mobx";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Toaster } from "sonner";
import "@/core/state/mobx";
import { randomId, withIdSource } from "@/core/lib/ids";
import { isCommand, type CommandName } from "@/modules/access/commands";
import type { PlatformData } from "@/modules/domain/types";
import type { ServerInfo } from "@/modules/server/api";
import { PlatformStore, type SignupInput } from "./platform-store";

/** Estado devolvido pelo servidor (dados que o perfil pode ver + integrações disponíveis). */
export interface ServerState {
  me: string | null;
  info: ServerInfo;
  data: PlatformData;
}
type Body = Partial<ServerState> & { error?: string | null; errors?: Record<string, string>; [k: string]: unknown };

export async function api(path: string, body?: unknown): Promise<{ ok: boolean; status: number; body: Body }> {
  try {
    const res = await fetch(path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    return { ok: res.ok, status: res.status, body: (await res.json().catch(() => ({}))) as Body };
  } catch {
    return { ok: false, status: 0, body: { error: "Sem conexão com o servidor. Verifique a internet e tente de novo." } };
  }
}
const hasState = (b: Body): b is Body & ServerState => !!b.data && "me" in b;

const EMPTY_INFO: ServerInfo = { store: "file", whatsapp: { enabled: false, embedded: false, appId: "", configId: "" }, ai: { enabled: false, model: "" } };

/** Situação da conexão com o servidor (fora do PlatformStore, que só tem regras e dados). */
export class Sync {
  pending = 0;
  error: string | null = null;
  info: ServerInfo = EMPTY_INFO;
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }
  set(patch: Partial<Pick<Sync, "pending" | "error" | "info">>) {
    Object.assign(this, patch);
  }
}

/**
 * As telas chamam os métodos do PlatformStore normalmente. Ações que dão certo na tela são enviadas
 * ao servidor com os mesmos argumentos e ids; o servidor repete com as mesmas regras e devolve os
 * dados confirmados. Login, cadastro e saída acontecem no servidor.
 */
function connect(raw: PlatformStore, sync: Sync): PlatformStore {
  let chain: Promise<void> = Promise.resolve();
  const apply = (s: ServerState) => {
    raw.replaceAll(s.data);
    raw.setHydrated(s.me);
    sync.set({ info: s.info });
  };
  const refresh = async () => {
    const r = await api("/api/state");
    if (hasState(r.body) && sync.pending === 0) apply(r.body);
    sync.set({ error: r.status === 0 || r.status === 503 ? (r.body.error ?? "Servidor indisponível.") : null });
  };
  const send = (name: CommandName, args: unknown[], ids: string[]) => {
    sync.set({ pending: sync.pending + 1 });
    chain = chain.then(async () => {
      const r = await api("/api/command", { name, args, ids });
      sync.set({ pending: sync.pending - 1 });
      if (r.status === 0) {
        sync.set({ error: r.body.error ?? "Sem conexão." });
        toast.error("A última alteração não chegou ao servidor. Recarregue a página.");
        return;
      }
      sync.set({ error: null });
      if (!r.ok) toast.error(r.body.error ?? "Não foi possível salvar.");
      if (hasState(r.body) && (!r.ok || sync.pending === 0)) apply(r.body);
      else if (r.status === 401) await refresh();
    });
  };
  const auth = {
    async login(email: string, password: string) {
      const r = await api("/api/auth/login", { email, password });
      if (!r.ok || !hasState(r.body)) return r.body.error ?? "Não foi possível entrar agora.";
      apply(r.body);
      return null;
    },
    async signup(input: SignupInput) {
      const errors = PlatformStore.validateSignup(input);
      if (Object.keys(errors).length) return errors;
      const r = await api("/api/auth/signup", input);
      if (r.body.errors) return r.body.errors;
      if (!r.ok || !hasState(r.body)) return { email: r.body.error ?? "Não foi possível criar a conta agora." };
      apply(r.body);
      return {};
    },
    logout() {
      raw.logout();
      void api("/api/auth/logout", {}).then(refresh);
    },
  };
  const proxy = new Proxy(Object.create(PlatformStore.prototype) as PlatformStore, {
    set: (_, prop, value) => Reflect.set(raw, prop, value, raw),
    has: (_, prop) => Reflect.has(raw, prop),
    get(_, prop) {
      if (prop === "__refresh") return refresh;
      if (prop === "__flush") return () => chain;
      if (prop === "__apply") return apply;
      if (typeof prop === "string" && prop in auth) return auth[prop as keyof typeof auth];
      const value = Reflect.get(raw, prop, raw) as unknown;
      if (typeof value !== "function" || !isCommand(prop)) return value;
      return (...args: unknown[]) => {
        const ids: string[] = [];
        const result = withIdSource(() => {
          const id = randomId();
          ids.push(id);
          return id;
        }, () => (value as (...a: unknown[]) => unknown).apply(raw, args));
        // Comandos que devolvem texto = recusados na tela (não vão ao servidor). Ids (simulateIncoming) seguem.
        const refused = typeof result === "string" && !(prop === "simulateIncoming" && result.startsWith("c-"));
        if (!refused) send(prop, JSON.parse(JSON.stringify(args)) as unknown[], ids);
        return result;
      };
    },
  });
  return proxy;
}

type Connected = PlatformStore & { __refresh: () => Promise<void>; __flush: () => Promise<void>; __apply: (s: ServerState) => void };

const Ctx = createContext<{ store: Connected; sync: Sync } | null>(null);

/** Restaurar demonstração (backoffice): recria os dados no servidor. */
export async function resetDemo(store: PlatformStore): Promise<string | null> {
  const r = await api("/api/admin/reset", {});
  if (!r.ok) return r.body.error ?? "Não foi possível restaurar.";
  store.logout();
  await (store as Connected).__refresh();
  return null;
}

export function PlatformProvider({ initial, children }: { initial: ServerState | null; children: ReactNode }) {
  const [ctx] = useState(() => {
    const raw = new PlatformStore({ plans: [], workspaces: [], knowledge: [], conversations: [], invoices: [], users: [], settings: { trialDays: 14, usageAlert: 0.8 }, mrrHistory: [] });
    raw.autoReply = false; // a resposta vem do servidor (IA ou motor), depois da mensagem
    const sync = new Sync();
    const store = connect(raw, sync) as Connected;
    if (initial) store.__apply(initial);
    return { store, sync };
  });
  useEffect(() => {
    const { store, sync } = ctx;
    if (!store.hydrated) void store.__refresh();
    // Mensagens reais chegam pelo WhatsApp a qualquer momento: atualiza com frequência quando logado.
    const tick = () => {
      if (document.visibilityState === "visible" && sync.pending === 0 && store.userId) void store.__refresh();
    };
    const timer = window.setInterval(tick, 8000);
    document.addEventListener("visibilitychange", tick);
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (sync.pending > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [ctx]);
  return (
    <Ctx.Provider value={ctx}>
      {children}
      <Toaster richColors position="top-right" />
    </Ctx.Provider>
  );
}

export function usePlatform(): Connected {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlatform precisa estar dentro de <PlatformProvider>.");
  return c.store;
}

export function useSync(): Sync {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSync precisa estar dentro de <PlatformProvider>.");
  return c.sync;
}
