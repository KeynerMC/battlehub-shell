import { customElement, bindable, resolve, IContainer } from 'aurelia';
import template from './game-host.html';
import type { GameContext, GameModule } from './game-contracts';
import { loadGameModule } from './remote-registry';
import { GameLoadError } from './game-errors';
import { GAME_START, GAME_STARTED } from './game-events';
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
  private operation = 0;
  private transitioning = false;
  private readonly disposals = new WeakMap<GameModule, Promise<void>>();

  public async load(): Promise<void> {
    if (!this.context || this.status === 'loading' || this.component) return;
    const operation = ++this.operation;
    const context = this.context;
    let instance: GameModule | null = null;
    this.error = null;
    this.status = 'loading';
    try {
      const Ctor = await this.loadWithRetry(operation, context.gameType);
      if (operation !== this.operation) return;
      instance = this.container.invoke(Ctor as never) as GameModule;
      for (const m of ['initialize', 'start', 'pause', 'dispose'] as const) {
        if (typeof (instance as unknown as Record<string, unknown>)[m] !== 'function') {
          throw new GameLoadError('INVALID_MODULE', `El módulo remoto no implementa ${m}()`, false);
        }
      }
      try {
        await instance.initialize(context);
        if (operation !== this.operation) { await this.disposeRemote(instance); return; }
        this.component = instance;
        await new Promise(r => setTimeout(r)); // esperar a que se renderice en el área del juego
        if (operation !== this.operation) return;
        if (context.events) {
          // El host adapta la orden por evento al ciclo de vida del modulo.
          let starting: Promise<void> | undefined;
          const start = () => {
            starting = Promise.resolve().then(async () => {
              if (operation === this.operation) await instance!.start();
            });
          };
          context.events.addEventListener(GAME_START, start, { once: true });
          try {
            context.events.dispatchEvent(new CustomEvent(GAME_START, { detail: { matchId: context.matchId, gameType: context.gameType } }));
            await starting;
          } finally { context.events.removeEventListener(GAME_START, start); }
        } else {
          await instance.start(); // Compatibilidad del demo sin canal de eventos.
        }
      } catch (e) {
        throw e instanceof GameLoadError ? e : new GameLoadError('LIFECYCLE_ERROR', String(e), false);
      }
      if (operation === this.operation) {
        this.status = 'running';
        context.events?.dispatchEvent(new CustomEvent(GAME_STARTED, { detail: { matchId: context.matchId, gameType: context.gameType } }));
      }
    } catch (e) {
      if (operation !== this.operation) {
        if (instance) await this.disposeRemote(instance);
        return;
      }
      this.component = null;
      if (instance && typeof instance.dispose === 'function') {
        await this.disposeRemote(instance);
      }
      if (operation !== this.operation) return;
      this.error = e instanceof GameLoadError ? e : new GameLoadError('REMOTE_UNREACHABLE', String(e), true);
      this.status = 'error';
      console.error('[shell] error cargando juego', this.error.code, this.error.message);
    }
  }

  public pause(): Promise<void> { return this.transition('running', 'paused', 'pause'); }
  public resume(): Promise<void> { return this.transition('paused', 'running', 'start'); }

  private async transition(from: 'running' | 'paused', to: 'running' | 'paused', method: 'pause' | 'start'): Promise<void> {
    if (!this.component || this.status !== from || this.transitioning) return;
    const instance = this.component;
    const operation = this.operation;
    this.transitioning = true;
    try {
      await instance[method]();
      if (operation === this.operation) this.status = to;
    } catch {
      if (operation !== this.operation) return;
      this.component = null;
      await this.disposeRemote(instance);
      if (operation !== this.operation) return;
      this.error = new GameLoadError('LIFECYCLE_ERROR', 'No se pudo cambiar el estado del juego. Vuelve a abrirlo desde las salas.', false);
      this.status = 'error';
    } finally { this.transitioning = false; }
  }

  private disposeRemote(instance: GameModule): Promise<void> {
    let pending = this.disposals.get(instance);
    if (!pending) {
      pending = Promise.resolve().then(() => instance.dispose()).catch(error => {
        console.error('[shell] limpieza del juego', error);
      });
      this.disposals.set(instance, pending);
    }
    return pending;
  }

  public async exit(): Promise<void> {
    try { await this.release(); } finally { this.onExit?.(); }
  }

  public async detaching(): Promise<void> {
    await this.release();
  }

  private async release(): Promise<void> {
    ++this.operation;
    const component = this.component;
    this.component = null;
    this.status = 'idle';
    this.error = null;
    this.attempt = 0;
    if (component) await this.disposeRemote(component);
  }

  private async loadWithRetry(operation: number, gameType: string): Promise<unknown> {
    let lastError: GameLoadError | null = null;
    for (let i = 0; i <= AUTO_RETRY_DELAYS_MS.length; i++) {
      if (operation !== this.operation) throw new Error('Carga cancelada');
      this.attempt = i + 1;
      try {
        const mod = await withTimeout(loadGameModule(gameType), LOAD_TIMEOUT_MS);
        if (!mod) {
          throw new GameLoadError('REMOTE_NOT_REGISTERED', `No hay remote configurado para gameType "${gameType}"`, false);
        }
        if (typeof mod.GameModule !== 'function') {
          throw new GameLoadError('INVALID_MODULE', 'El remote no exporta "GameModule"', false);
        }
        return mod.GameModule;
      } catch (e) {
        if (operation !== this.operation) throw e;
        lastError = e instanceof GameLoadError ? e : new GameLoadError('REMOTE_UNREACHABLE', String(e), true);
        if (!lastError.retryable || i === AUTO_RETRY_DELAYS_MS.length) break;
        console.warn(`[shell] intento ${i + 1} falló (${lastError.code}), reintentando...`);
        await new Promise(r => setTimeout(r, AUTO_RETRY_DELAYS_MS[i]));
      }
    }
    throw lastError;
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new GameLoadError('REMOTE_TIMEOUT', `Tiempo de carga excedido (${ms} ms)`, true)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
