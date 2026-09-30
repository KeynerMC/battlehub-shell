import type { GameContext } from '../../games/game-contracts';
import type { GameHost } from '../../games/game-host';
import { resolve } from 'aurelia';
import { IAuthService } from '../../auth/auth-service';

export class PlayPage {
  private readonly auth = resolve(IAuthService);
  public host?: GameHost;
  public inMatch = false;
  public context: GameContext;

  public canLoad(): boolean | string {
    return this.auth.user ? true : 'login';
  }

  public onExit = () => { this.inMatch = false; };

  public async startMatch(): Promise<void> {
    if (!this.host || this.inMatch || !this.auth.user) return;
    this.context = {
      matchId: 'demo-match-001',
      gameType: 'demo',
      currentUser: { ...this.auth.user },
    };
    this.host.context = this.context;
    this.inMatch = true;
    await this.host.load();
  }
}
