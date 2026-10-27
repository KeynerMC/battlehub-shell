import { createFixture } from '@aurelia/testing';
import { customElement } from 'aurelia';
import { GameHost } from '../../src/games/game-host';
import { GAME_START, GAME_STARTED } from '../../src/games/game-events';
import { loadGameModule } from '../../src/games/remote-registry';

jest.mock('../../src/games/remote-registry', () => ({ loadGameModule: jest.fn() }));

const context = { matchId: 'test-match', gameType: 'demo', currentUser: { id: 'test-user', displayName: 'Test' } };

async function createHost() {
  const state = { context, host: null as GameHost | null };
  await createFixture('<game-host component.ref="host" context.bind="context"></game-host>', state, [GameHost]).started;
  return state.host!;
}

describe('GameHost', () => {
  beforeEach(() => {
    jest.mocked(loadGameModule).mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('inicializa, monta, pausa, reanuda y libera el componente una sola vez', async () => {
    const initialize = jest.fn().mockResolvedValue(undefined);
    const start = jest.fn().mockResolvedValue(undefined);
    const pause = jest.fn().mockResolvedValue(undefined);
    const dispose = jest.fn().mockResolvedValue(undefined);
    @customElement({ name: 'test-remote', template: '<p data-testid="remote">Juego remoto</p>' })
    class Remote {
      initialize = initialize;
      start = start;
      pause = pause;
      dispose = dispose;
    }
    jest.mocked(loadGameModule).mockResolvedValue({ GameModule: Remote });
    const host = await createHost();
    await host.load();
    expect(initialize).toHaveBeenCalledWith(context);
    expect(host.status).toBe('running');
    expect(document.querySelector('[data-testid="remote"]')).not.toBeNull();
    await host.pause();
    expect(pause).toHaveBeenCalledTimes(1);
    expect(host.status).toBe('paused');
    await host.resume();
    expect(start).toHaveBeenCalledTimes(2);
    await host.exit();
    await host.detaching();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(host.status).toBe('idle');
  });

  it('muestra un error no reintentable para un juego sin registro', async () => {
    jest.mocked(loadGameModule).mockResolvedValue(null);
    const host = await createHost();
    host.context = context;
    await host.load();
    expect(host.status).toBe('error');
    expect(host.error?.code).toBe('REMOTE_NOT_REGISTERED');
    expect(loadGameModule).toHaveBeenCalledTimes(1);
  });

  it('rechaza un remote que no exporta GameModule', async () => {
    jest.mocked(loadGameModule).mockResolvedValue({});
    const host = await createHost();
    await host.load();
    expect(host.error?.code).toBe('INVALID_MODULE');
  });

  it('no inicia un remote que termina de cargar después de salir', async () => {
    let finish: (value: Record<string, unknown>) => void;
    jest.mocked(loadGameModule).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const initialize = jest.fn();
    class Remote { initialize = initialize; }
    const host = await createHost();
    const loading = host.load();
    await host.exit();
    finish({ GameModule: Remote });
    await loading;
    expect(initialize).not.toHaveBeenCalled();
    expect(host.component).toBeNull();
    expect(host.status).toBe('idle');
  });

  it('libera recursos cuando initialize falla', async () => {
    const dispose = jest.fn().mockResolvedValue(undefined);
    class Remote {
      initialize = jest.fn().mockRejectedValue(new Error('Error de preparación'));
      start = jest.fn();
      pause = jest.fn();
      dispose = dispose;
    }
    jest.mocked(loadGameModule).mockResolvedValue({ GameModule: Remote });
    const host = await createHost();
    await host.load();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(host.error?.code).toBe('LIFECYCLE_ERROR');
    expect(host.component).toBeNull();
  });
  it('libera el remote si initialize falla despues de salir', async () => {
    let fail!: (error: Error) => void;
    const dispose = jest.fn().mockResolvedValue(undefined);
    class Remote {
      initialize = jest.fn(() => new Promise<void>((_, reject) => { fail = reject; }));
      start = jest.fn(); pause = jest.fn(); dispose = dispose;
    }
    jest.mocked(loadGameModule).mockResolvedValue({ GameModule: Remote });
    const host = await createHost();
    const loading = host.load();
    while (!fail) await Promise.resolve();
    await host.exit();
    fail(new Error('Conexion cancelada'));
    await loading;
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(host.status).toBe('idle');
    expect(host.component).toBeNull();
  });

  it('evita cargas duplicadas y limpia una sola vez si start falla despues de salir', async () => {
    let fail!: (error: Error) => void;
    const dispose = jest.fn().mockResolvedValue(undefined);
    class Remote {
      initialize = jest.fn().mockResolvedValue(undefined);
      start = jest.fn(() => new Promise<void>((_, reject) => { fail = reject; }));
      pause = jest.fn(); dispose = dispose;
    }
    jest.mocked(loadGameModule).mockResolvedValue({ GameModule: Remote });
    const host = await createHost();
    const loading = host.load();
    await host.load();
    while (!fail) await new Promise(resolve => setTimeout(resolve, 0));
    await host.exit();
    fail(new Error('Inicio cancelado'));
    await loading;
    expect(loadGameModule).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(host.status).toBe('idle');
  });

  it('maneja un fallo al pausar y permite salir aunque dispose falle', async () => {
    const dispose = jest.fn().mockRejectedValue(new Error('Error al desconectar'));
    class Remote {
      initialize = jest.fn().mockResolvedValue(undefined);
      start = jest.fn().mockResolvedValue(undefined);
      pause = jest.fn().mockRejectedValue(new Error('Error al pausar'));
      dispose = dispose;
    }
    jest.mocked(loadGameModule).mockResolvedValue({ GameModule: Remote });
    const host = await createHost();
    await host.load();
    await host.pause();
    expect(host.status).toBe('error');
    expect(host.error?.code).toBe('LIFECYCLE_ERROR');
    await expect(host.exit()).resolves.toBeUndefined();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('reintenta dos veces un remote caido y permite reintentar manualmente', async () => {
    const host = await createHost();
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      jest.mocked(loadGameModule).mockRejectedValue(new Error('Sin red'));
      const loading = host.load();
      await jest.runAllTimersAsync();
      await loading;
      expect(loadGameModule).toHaveBeenCalledTimes(3);
      expect(host.error?.retryable).toBe(true);
      jest.mocked(loadGameModule).mockResolvedValue(null);
      await host.load();
      expect(loadGameModule).toHaveBeenCalledTimes(4);
      expect(host.error?.code).toBe('REMOTE_NOT_REGISTERED');
    } finally { jest.useRealTimers(); }
  });

  it('limita el tiempo de carga y no monta un remote que responde tarde', async () => {
    const host = await createHost();
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      let finish!: (value: Record<string, unknown>) => void;
      jest.mocked(loadGameModule).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
      const loading = host.load();
      await jest.runAllTimersAsync();
      await loading;
      expect(host.error?.code).toBe('REMOTE_TIMEOUT');
      expect(host.attempt).toBe(3);
      const initialize = jest.fn();
      finish({ GameModule: class { initialize = initialize; } });
      await Promise.resolve();
      expect(initialize).not.toHaveBeenCalled();
      expect(host.component).toBeNull();
    } finally { jest.useRealTimers(); }
  });

  it('inicia por el canal de eventos sin duplicar start y confirma el arranque', async () => {
    const start = jest.fn().mockResolvedValue(undefined);
    class Remote {
      initialize = jest.fn().mockResolvedValue(undefined);
      start = start; pause = jest.fn(); dispose = jest.fn().mockResolvedValue(undefined);
    }
    jest.mocked(loadGameModule).mockResolvedValue({ GameModule: Remote });
    const host = await createHost();
    const events = new EventTarget();
    const requested = jest.fn(); const started = jest.fn();
    events.addEventListener(GAME_START, requested);
    events.addEventListener(GAME_STARTED, started);
    host.context = { ...context, events };
    await host.load();
    expect(requested).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(started).toHaveBeenCalledTimes(1);
    expect((requested.mock.calls[0][0] as CustomEvent).detail).toEqual({ matchId: context.matchId, gameType: context.gameType });
    events.dispatchEvent(new CustomEvent(GAME_START));
    expect(start).toHaveBeenCalledTimes(1);
  });

});
