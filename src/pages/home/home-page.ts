import { resolve } from 'aurelia';
import { IAuthService } from '../../auth/auth-service';
import { gameArtwork, gamePresentation } from '../../games/game-presentation';
import { IProfileService } from '../../profile/profile-service';
import { IRemoteMatchmaking } from '../../matchmaking/remote-matchmaking-service';
import { IMatchmakingService } from '../../matchmaking/matchmaking-service';
import type { CatalogGame } from '../../profile/profile-models';

export class HomePage {
  public readonly auth = resolve(IAuthService);
  public readonly artwork = gameArtwork;
  public readonly presentation = gamePresentation;
  private readonly profiles = resolve(IProfileService);
  private readonly matchmaking = resolve(IRemoteMatchmaking);
  private readonly mockMatchmaking = resolve(IMatchmakingService);
  public games: CatalogGame[] = [];
  public rooms: { id: string; title: string; gameType: string; currentPlayers: number; maxPlayers: number }[] = [];
  public busy = false;
  public gameError = '';
  public roomError = '';
  public async loading(): Promise<void> {
    const user = this.auth.user;
    this.games = [];
    this.rooms = [];
    this.gameError = '';
    this.roomError = '';
    if (!user) return;
    this.busy = true;
    const results = await Promise.allSettled([
      this.profiles.getEnabledGames(),
      this.auth.mode === 'auth0' ? this.matchmaking.list() : this.mockMatchmaking.list().then(rooms =>
        rooms.map(room => ({ ...room, gameType: 'demo', currentPlayers: room.participants.length }))),
    ]);
    if (this.auth.user === user) {
      const [games, rooms] = results;
      if (games.status === 'fulfilled') this.games = games.value;
      else this.gameError = 'No se pudo consultar tu catálogo.';
      if (rooms.status === 'fulfilled') this.rooms = rooms.value;
      else this.roomError = 'No se pudo consultar la lista de salas. Puedes reintentar desde Salas.';
    }
    this.busy = false;
  }
  public readonly featuredGames = [
    { gameType: 'typing', name: 'Typing Battle' },
    { gameType: 'trivia', name: 'Trivia Battle' },
    { gameType: 'memory', name: 'Memory Match' },
  ];
}
