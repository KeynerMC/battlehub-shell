import type { GameContext } from './game-contracts';
import type { GameHost } from './game-host';
import './my-app.css';

export class MyApp {
  public inMatch = false;
  public host?: GameHost;
  public aureliaVersion = '2.0.0-rc.2';
  public context: GameContext = {
    matchId: 'match-001',
    gameType: 'demo',
    currentUser: { id: 'user-001', displayName: 'Francisco' },
  };

  public onExit = () => { this.inMatch = false; };

  public async startMatch(): Promise<void> {
    this.inMatch = true;
    await new Promise(r => setTimeout(r));
    await this.host?.load();
  }
}
