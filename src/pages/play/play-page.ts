import type { GameContext } from '../../games/game-contracts';
import type { GameHost } from '../../games/game-host';
import { resolve } from 'aurelia';
import { IAuthService } from '../../auth/auth-service';
import { IRouter, type Params } from '@aurelia/router';
import { IMatchmakingService } from '../../matchmaking/matchmaking-service';

export class PlayPage {
  private readonly auth = resolve(IAuthService);
  private readonly matchmaking = resolve(IMatchmakingService);
  private readonly router = resolve(IRouter);
  public roomId: string | null = null;
  public error = '';
  public host?: GameHost;
  public inMatch = false;
  public context: GameContext;

  public async canLoad(params: Params = {}): Promise<boolean | string> {
    if (!this.auth.user) return 'login';
    this.roomId = typeof params.roomId === 'string' ? params.roomId : null;
    if (this.roomId) {
      try { this.context = await this.matchmaking.prepareGame(this.roomId); }
      catch { return 'lobby'; }
    }
    return true;
  }

  public onExit = () => {
    this.inMatch = false;
    if (this.roomId) {
      void this.router.load('lobby').catch(() => { this.error = 'No se pudo volver a las salas. Usa el menú Salas.'; });
    }
  };

  public async attached(): Promise<void> {
    if (this.roomId) await this.startMatch();
  }

  public async startMatch(): Promise<void> {
    if (!this.host || this.inMatch || !this.auth.user) return;
    this.error = '';
    this.inMatch = true;
    try {
      this.context = this.roomId ? await this.matchmaking.prepareGame(this.roomId) : {
      matchId: 'demo-match-001',
      gameType: 'demo',
      currentUser: { ...this.auth.user },
    };
    this.host.context = this.context;
    await this.host.load();
    } catch (error) {
      this.inMatch = false;
      this.error = error instanceof Error ? error.message : 'No se pudo iniciar el demo.';
    }
  }
}
