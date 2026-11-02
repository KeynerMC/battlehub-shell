// Propuesta de eventos Shell-juego; los nombres deben acordarse con los equipos.
export const GAME_START = 'battlehub:game-start';
export const GAME_STARTED = 'battlehub:game-started';
export const GAME_FINISHED = 'battlehub:game-finished';

export interface GameEventDetail { matchId: string; gameType: string }

export function isGameEvent(event: Event, matchId: string, gameType: string): boolean {
  if (!(event instanceof CustomEvent)) return false;
  const detail = event.detail as Partial<GameEventDetail> | null;
  return !!detail && detail.matchId === matchId && detail.gameType === gameType;
}
