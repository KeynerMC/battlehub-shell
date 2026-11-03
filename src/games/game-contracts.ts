// Tipos del contrato 03-contratos-tecnicos.md (secciones 5 y 6).
export interface GameParticipant {
  userId: string;
  displayName: string;
}

export interface GameContext {
  matchId: string;
  gameType: 'typing' | 'trivia' | 'memory' | string;
  currentUser: { id: string; displayName: string };
  // Siempre presente en partidas de Matchmaking; opcional para contextos demo antiguos.
  // Es contexto de inicio, no una credencial ni una suscripcion a cambios de la sala.
  participants?: GameParticipant[];
  // Canal local por partida. No contiene tokens ni acredita identidad ante el servidor.
  events?: EventTarget;
}

// Practica no representa una sala ni una partida persistida.
export interface PracticeContext {
  mode: 'practice';
  matchId?: never;
  gameType: string;
  currentUser: { id: string; displayName: string };
  events: EventTarget;
}
export type GameLaunchContext = GameContext | PracticeContext;

export interface GameModule {
  initialize(context: GameLaunchContext): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  dispose(): Promise<void>;
}
