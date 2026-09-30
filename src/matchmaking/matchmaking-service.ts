import { DI } from 'aurelia';
import type { SessionUser } from '../auth/auth-service';

// Modelos internos del mock; no definen los DTOs ni eventos del Equipo 2.
export interface LobbyRoom {
  id: string;
  title: string;
  gameType: string;
  createdAt: string;
  maxPlayers: number;
  participants: SessionUser[];
}

export interface MatchmakingService {
  list(): Promise<LobbyRoom[]>;
  create(title: string): Promise<void>;
  join(roomId: string): Promise<void>;
  leave(): Promise<void>;
}

export const IMatchmakingService = DI.createInterface<MatchmakingService>('IMatchmakingService');
