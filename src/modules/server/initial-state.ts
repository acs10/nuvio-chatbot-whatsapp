import "server-only";
import { viewFor } from "@/modules/access/views";
import type { PlatformData } from "@/modules/domain/types";
import { serverInfo, type ServerInfo } from "./api";
import { actorOf, readData } from "./platform-service";
import { getSessionAccountId } from "./session";

export interface ServerState {
  me: string | null;
  info: ServerInfo;
  data: PlatformData;
}

/** Estado inicial já no HTML; se o banco falhar, o navegador tenta depois. */
export async function getInitialState(): Promise<ServerState | null> {
  // Lido fora do try: o Next precisa saber que a página depende do cookie (sempre dinâmica).
  const accountId = await getSessionAccountId();
  try {
    const data = await readData();
    const actor = actorOf(data.users, accountId, data);
    return { me: actor?.id ?? null, info: serverInfo(), data: viewFor(data, actor) };
  } catch (error) {
    console.error("[initial-state]", error);
    return null;
  }
}
