// Carga dinámica de remotes de Module Federation en tiempo de ejecución (ADR-003).
// - Las URLs se leen de /remotes.config.json (un archivo por ambiente, sin recompilar el Shell).
// - Si la carga falla, se elimina el <script> y el contenedor para que el reintento vuelva a pedir el archivo
//   (el import() estático de webpack deja el fallo en caché y no permite reintentar).

declare const __webpack_init_sharing__: (scope: string) => Promise<void>;
declare const __webpack_share_scopes__: { default: unknown };

interface RemoteContainer {
  init(shareScope: unknown): Promise<void>;
  get(module: string): Promise<() => Record<string, unknown>>;
}

export interface RemoteEntry { scope: string; url: string; module: string }
export type RemotesConfig = Record<string, RemoteEntry>;

let configPromise: Promise<RemotesConfig> | null = null;
const initialized = new Set<string>();

export function loadRemotesConfig(): Promise<RemotesConfig> {
  configPromise ??= fetch('/remotes.config.json', { cache: 'no-store' }).then(r => {
    if (!r.ok) throw new Error(`No se pudo leer remotes.config.json (${r.status})`);
    return r.json() as Promise<RemotesConfig>;
  }).catch(e => { configPromise = null; throw e; });
  return configPromise;
}

function loadScript(url: string, scope: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = `${url}?t=${Date.now()}`; // evita respuestas en caché de un intento fallido
    el.async = true;
    el.dataset.remote = scope;
    el.onload = () => resolve();
    el.onerror = () => { el.remove(); reject(new Error(`No se pudo descargar ${url}`)); };
    document.head.appendChild(el);
  });
}

export async function loadRemoteModule(entry: RemoteEntry): Promise<Record<string, unknown>> {
  const w = window as unknown as Record<string, RemoteContainer | undefined>;
  try {
    if (!w[entry.scope]) await loadScript(entry.url, entry.scope);
    const container = w[entry.scope];
    if (!container) throw new Error(`El script no registró el contenedor "${entry.scope}"`);
    if (!initialized.has(entry.scope)) {
      await __webpack_init_sharing__('default');
      await container.init(__webpack_share_scopes__.default);
      initialized.add(entry.scope);
    }
    const factory = await container.get(entry.module);
    return factory();
  } catch (e) {
    // Limpieza para permitir un reintento real.
    document.querySelectorAll(`script[data-remote="${entry.scope}"]`).forEach(s => s.remove());
    delete w[entry.scope];
    initialized.delete(entry.scope);
    throw e;
  }
}
