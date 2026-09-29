// Errores de carga de microfrontends (ADR-003 §6).
export type GameLoadErrorCode =
  | 'REMOTE_CONFIG_ERROR'     // no se pudo leer remotes.config.json
  | 'REMOTE_NOT_REGISTERED'   // gameType sin remote configurado en el Shell
  | 'REMOTE_UNREACHABLE'      // remoteEntry.js o sus chunks no cargan (servidor caído, red, CORS)
  | 'REMOTE_TIMEOUT'          // la carga excede el tiempo límite
  | 'INVALID_MODULE'          // el remote no exporta GameModule o no implementa la interfaz
  | 'LIFECYCLE_ERROR';        // initialize() o start() lanzaron una excepción

export class GameLoadError extends Error {
  constructor(public code: GameLoadErrorCode, message: string, public retryable: boolean) {
    super(message);
  }
}
