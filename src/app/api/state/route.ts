import { handle, sessionActor, stateResponse } from "@/modules/server/api";
import { readData } from "@/modules/server/platform-service";

/** Dados que o visitante (ou o perfil logado) pode ver. */
export async function GET() {
  return handle("state", async () => {
    const data = await readData();
    return stateResponse(data, await sessionActor(data));
  });
}
