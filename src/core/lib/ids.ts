/** Ids compartilhados por navegador e servidor (o servidor repete a ação com os mesmos ids). */
export const randomId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
let idSource: (() => string) | null = null;

export const newId = () => idSource?.() ?? randomId();

export const ID_PATTERN = /^[a-z0-9]{8,24}$/;

/** Executa `fn` com outra fonte de ids (gravar no navegador, repetir no servidor). */
export function withIdSource<T>(source: () => string | undefined, fn: () => T): T {
  const previous = idSource;
  idSource = () => source() ?? randomId();
  try {
    return fn();
  } finally {
    idSource = previous;
  }
}
