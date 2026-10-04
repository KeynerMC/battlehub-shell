import { resolve } from 'aurelia';
import { IAuthService } from '../../auth/auth-service';
import { IMatchmakingService, type LobbyRoom } from '../../matchmaking/matchmaking-service';

export class LobbyPage {
  public readonly auth = resolve(IAuthService);
  private readonly matchmaking = resolve(IMatchmakingService);
  public rooms: LobbyRoom[] = [];
  public title = '';
  public busy = false;
  public error = '';

  public canLoad(): boolean | string {
    if (this.auth.mode === 'auth0') return 'catalog';
    return this.auth.user ? true : 'login';
  }
  public loading(): Promise<void> { return this.refresh(); }
  public isMember(room: LobbyRoom): boolean {
    return room.participants.some(player => player.id === this.auth.user?.id);
  }
  public get currentRoom(): LobbyRoom | undefined { return this.rooms.find(room => this.isMember(room)); }

  private async run(action?: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      if (action) await action();
      this.rooms = await this.matchmaking.list();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudieron actualizar las salas.';
    } finally { this.busy = false; }
  }

  public refresh(): Promise<void> { return this.run(); }
  public create(): Promise<void> {
    return this.run(async () => { await this.matchmaking.create(this.title); this.title = ''; });
  }
  public join(id: string): Promise<void> { return this.run(() => this.matchmaking.join(id)); }
  public leave(): Promise<void> { return this.run(() => this.matchmaking.leave()); }
}
