import type { GameContext } from '../../games/game-contracts';
import type { GameHost } from '../../games/game-host';

export class PlayPage {
  public host?: GameHost;
  public inMatch = false;
  public readonly context: GameContext = {
    matchId: 'demo-match-001',
    gameType: 'demo',
    currentUser: { id: 'demo-user', displayName: 'Jugador de prueba' },
  };

  public onExit = () => { this.inMatch = false; };

  public async startMatch(): Promise<void> {
    if (!this.host || this.inMatch) return;
    this.inMatch = true;
    await this.host.load();
  }
}
