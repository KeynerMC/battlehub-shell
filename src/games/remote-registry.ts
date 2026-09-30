import { loadRemotesConfig, loadRemoteModule, type RemotesConfig } from './remote-loader';
import { GameLoadError } from './game-errors';

// gameType -> módulo remoto, según /remotes.config.json del ambiente (ADR-003 §4).
export async function loadGameModule(gameType: string): Promise<Record<string, unknown> | null> {
  let config: RemotesConfig;
  try {
    config = await loadRemotesConfig();
  } catch (e) {
    throw new GameLoadError('REMOTE_CONFIG_ERROR', String(e), true);
  }
  const entry = config[gameType];
  if (!entry) return null;
  return loadRemoteModule(entry);
}
