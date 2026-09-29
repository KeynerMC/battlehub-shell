import { customElement, DI } from 'aurelia';
import template from './game-module.html';
import type { GameContext, GameModule as IGameModule } from './game-contracts';

@customElement({ name: 'demo-game-module', template })
export class GameModule implements IGameModule {
  public context!: GameContext;
  public state: 'created' | 'initialized' | 'running' | 'paused' | 'disposed' = 'created';
  public clicks = 0;

  public async initialize(context: GameContext): Promise<void> {
    (window as unknown as Record<string, unknown>).__remoteDI = DI; // evidencia: instancia compartida
    this.context = context;
    this.state = 'initialized';
    console.log('[demoGame] initialize', context);
  }

  public async start(): Promise<void> {
    this.state = 'running';
    console.log('[demoGame] start');
  }

  public async pause(): Promise<void> {
    this.state = 'paused';
    console.log('[demoGame] pause');
  }

  public async dispose(): Promise<void> {
    this.state = 'disposed';
    console.log('[demoGame] dispose');
  }
}
