import { customElement, bindable, resolve, IContainer } from 'aurelia';
import template from './game-host.html';
import type { GameContext, GameModule } from './game-contracts';
import { loadGameModule } from './remote-registry';
import { GameLoadError } from './game-errors';
export { GameLoadError } from './game-errors';

const LOAD_TIMEOUT_MS = 10_000;
const AUTO_RETRY_DELAYS_MS = [1_000, 2_000]; // 2 reintentos automáticos (total: 3 intentos)

@customElement({ name: 'game-host', template })
export class GameHost {
  @bindable public context!: GameContext;
  @bindable public onExit?: () => void;

  public status: 'idle' | 'loading' | 'running' | 'paused' | 'error' = 'idle';
  public attempt = 0;
  public error: GameLoadError | null = null;
  public component: GameModule | null = null;

  private readonly container = resolve(IContainer);

  public async load(): Promise<void> {
    this.error = null;
    this.status = 'loading';
    try {
      const Ctor = await this.loadWithRetry();
      const instance = this.container.invoke(Ctor as never) as GameModule;
      for (const m of ['initialize', 'start', 'pause', 'dispose'] as const) {
        if (typeof (instance as unknown as Record<string, unknown>)[m] !== 'function') {
          throw new GameLoadError('INVALID_MODULE', `El módulo remoto no implementa ${m}()`, false);
        }
      }
      try {
        await instance.initialize(this.context);
        this.component = instance;
        await new Promise(r => setTimeout(r)); // esperar a que se renderice en el área del juego
        await instance.start();
      } catch (e) {
        throw e instanceof GameLoadError ? e : new GameLoadError('LIFECYCLE_ERROR', String(e), false);
      }
      this.status = 'running';
    } catch (e) {
      this.component = null;
      this.error = e instanceof GameLoadError ? e : new GameLoadError('REMOTE_UNREACHABLE', String(e), true);
      this.status = 'error';
      console.error('[shell] error cargando juego', this.error.code, this.error.message);
    }
  }

  public async pause(): Promise<void> {
    if (this.component && this.status === 'running') { await this.component.pause(); this.status = 'paused'; }
  }

  public async resume(): Promise<void> {
    if (this.component && this.status === 'paused') { await this.component.start(); this.status = 'running'; }
  }

  public async exit(): Promise<void> {
    if (this.component) { await this.component.dispose(); }
    this.component = null;
    this.status = 'idle';
    this.onExit?.();
  }

  public async detaching(): Promise<void> {
    if (this.component) await this.component.dispose();
  }

  private async loadWithRetry(): Promise<unknown> {
    let lastError: GameLoadError | null = null;
    for (let i = 0; i <= AUTO_RETRY_DELAYS_MS.length; i++) {
      this.attempt = i + 1;
      try {
        const mod = await withTimeout(loadGameModule(this.context.gameType), LOAD_TIMEOUT_MS);
        if (!mod) {
          throw new GameLoadError('REMOTE_NOT_REGISTERED', `No hay remote configurado para gameType "${this.context.gameType}"`, false);
        }
        if (typeof mod.GameModule !== 'function') {
          throw new GameLoadError('INVALID_MODULE', 'El remote no exporta "GameModule"', false);
        }
        return mod.GameModule;
      } catch (e) {
        lastError = e instanceof GameLoadError ? e : new GameLoadError('REMOTE_UNREACHABLE', String(e), true);
        if (!lastError.retryable || i === AUTO_RETRY_DELAYS_MS.length) break;
        console.warn(`[shell] intento ${i + 1} falló (${lastError.code}), reintentando...`);
        await new Promise(r => setTimeout(r, AUTO_RETRY_DELAYS_MS[i]));
      }
    }
    throw lastError;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new GameLoadError('REMOTE_TIMEOUT', `Tiempo de carga excedido (${ms} ms)`, true)), ms)),
  ]);
}
