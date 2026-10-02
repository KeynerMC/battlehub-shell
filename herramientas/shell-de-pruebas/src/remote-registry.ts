import { loadRemotesConfig, loadRemoteModule, type RemoteEntry, type RemotesConfig } from './remote-loader';
import { GameLoadError } from './game-errors';

// El Shell de pruebas permite cambiar la URL de un juego desde la pantalla.
const overrides = new Map<string, RemoteEntry>();
export function setRemoteOverride(gameType: string, entry: RemoteEntry): void {
  overrides.set(gameType, entry);
}

export async function getRemotesConfig(): Promise<RemotesConfig> {
  try {
    return await loadRemotesConfig();
  } catch (e) {
    throw new GameLoadError('REMOTE_CONFIG_ERROR', String(e), true);
  }
}

// gameType -> módulo remoto (ADR-003 §4).
export async function loadGameModule(gameType: string): Promise<Record<string, unknown> | null> {
  const entry = overrides.get(gameType) ?? (await getRemotesConfig())[gameType];
  if (!entry) return null;
  return loadRemoteModule(entry);
}
