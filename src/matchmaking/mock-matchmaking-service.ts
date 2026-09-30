import { resolve } from 'aurelia';
import { IAuthService, type SessionUser } from '../auth/auth-service';
import type { LobbyRoom, MatchmakingService } from './matchmaking-service';

export class MockMatchmakingService implements MatchmakingService {
  private readonly auth = resolve(IAuthService);
  private session: SessionUser | null = null;
  private rooms: LobbyRoom[] = [];
  private sequence = 0;

  private user(): SessionUser {
    const user = this.auth.user;
    if (user !== this.session) {
      this.session = user;
      this.rooms = user ? [{
        id: 'sample-room', title: 'Sala de ejemplo (simulada)', gameType: 'demo',
        createdAt: new Date().toISOString(), maxPlayers: 2,
        participants: [{ id: 'sample-player', displayName: 'Participante simulado' }],
      }] : [];
    }
    if (!user) throw new Error('Entra en una sesión de prueba para ver las salas.');
    return user;
  }

  public async list(): Promise<LobbyRoom[]> {
    this.user();
    return this.rooms.map(room => ({ ...room, participants: room.participants.map(player => ({ ...player })) }));
  }

  public async create(title: string): Promise<void> {
    const user = this.user();
    const name = title.trim();
    if (!name || name.length > 60) throw new Error('Escribe un título de entre 1 y 60 caracteres.');
    if (this.rooms.some(room => room.participants.some(player => player.id === user.id))) {
      throw new Error('Sal de tu sala actual antes de crear otra.');
    }
    this.rooms.push({ id: `local-room-${++this.sequence}`, title: name, gameType: 'demo',
      createdAt: new Date().toISOString(), maxPlayers: 2, participants: [{ ...user }] });
  }

  public async join(roomId: string): Promise<void> {
    const user = this.user();
    const room = this.rooms.find(item => item.id === roomId);
    if (!room) throw new Error('La sala ya no está disponible.');
    if (room.participants.some(player => player.id === user.id)) return;
    if (this.rooms.some(item => item.participants.some(player => player.id === user.id))) {
      throw new Error('Sal de tu sala actual antes de entrar a otra.');
    }
    if (room.participants.length >= room.maxPlayers) throw new Error('La sala está llena.');
    room.participants.push({ ...user });
  }

  public async leave(): Promise<void> {
    const user = this.user();
    for (const room of this.rooms) room.participants = room.participants.filter(player => player.id !== user.id);
    this.rooms = this.rooms.filter(room => room.participants.length > 0);
  }
}
