// Tipos del contrato 03-contratos-tecnicos.md (secciones 5 y 6).
export interface GameContext {
  matchId: string;
  gameType: 'typing' | 'trivia' | 'memory' | string;
  currentUser: { id: string; displayName: string };
  // Extensión local acordada para Typing; no modifica el contrato central.
  getAccessToken?: () => Promise<string>;
}

export interface GameModule {
  initialize(context: GameContext): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  dispose(): Promise<void>;
}
