import { createFixture } from '@aurelia/testing';
import { customElement } from 'aurelia';
import { GameHost } from '../../src/games/game-host';
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
});
