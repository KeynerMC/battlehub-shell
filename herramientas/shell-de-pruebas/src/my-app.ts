// Shell de pruebas para los Equipos 4, 5 y 6 (ADR-003).
// Simula lo que hará el Shell real: carga su juego por Module Federation y llama a los 4 métodos del contrato.
import type { GameContext } from './game-contracts';
import type { GameHost } from './game-host';
import { getRemotesConfig, setRemoteOverride } from './remote-registry';
import type { RemotesConfig } from './remote-loader';
import './my-app.css';

interface LogLine { time: string; message: string; level: string }

export class MyApp {
  public readonly aureliaVersion = '2.0.0-rc.2';
  public readonly games = [
    { type: 'typing', label: 'Typing Battle (Equipo 4)' },
    { type: 'trivia', label: 'Trivia Battle (Equipo 5)' },
    { type: 'memory', label: 'Memory Match (Equipo 6)' },
  ];

  public gameType = 'typing';
  public url = '';
  public matchId = 'match-prueba-001';
  public displayName = 'Jugador de prueba';

  public inMatch = false;
  public host?: GameHost;
  public context!: GameContext;
  public logs: LogLine[] = [];

  private config: RemotesConfig = {};
  private readonly loadedUrls = new Map<string, string>();

  public async binding(): Promise<void> {
    try {
      this.config = await getRemotesConfig();
    } catch (e) {
      this.log(`No se pudo leer remotes.config.json: ${String(e)}`, 'error');
    }
    this.gameTypeChanged();
  }

  public gameTypeChanged(): void {
    this.url = this.config[this.gameType]?.url ?? '';
  }

  public async startMatch(): Promise<void> {
    const base = this.config[this.gameType];
    if (!base) { this.log(`gameType "${this.gameType}" no está en remotes.config.json`, 'error'); return; }
    const previous = this.loadedUrls.get(base.scope);
    if (previous && previous !== this.url) {
      this.log('Ese juego ya se cargó con otra URL. Recargá la página (F5) para usar la nueva.', 'warn');
      return;
    }
    setRemoteOverride(this.gameType, { ...base, url: this.url });
    this.context = {
      matchId: this.matchId,
      gameType: this.gameType as GameContext['gameType'],
      currentUser: { id: 'user-prueba', displayName: this.displayName },
    };
    this.log(`Simulando MatchStarted → ${this.url}`);
    this.inMatch = true;
    await new Promise(r => setTimeout(r));
    await this.host?.load();
    if (this.host?.status === 'running') this.loadedUrls.set(base.scope, this.url);
  }

  public onExit = (): void => { this.inMatch = false; };

  public onLog = (message: string, level: string = 'info'): void => this.log(message, level);

  public clearLog(): void { this.logs = []; }

  private log(message: string, level = 'info'): void {
    const time = new Date().toLocaleTimeString();
    this.logs = [{ time, message, level }, ...this.logs].slice(0, 100);
  }
}
