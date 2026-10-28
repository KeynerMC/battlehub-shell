import { loadRemoteModule, loadRemotesConfig } from '../../../src/games/remote-loader';

describe('carga de remotes reales en el navegador', () => {
  beforeEach(() => {
    Object.assign(globalThis, { __webpack_init_sharing__: jest.fn().mockResolvedValue(undefined), __webpack_share_scopes__: { default: {} } });
  });
  afterEach(() => {
    document.querySelectorAll('script[data-remote]').forEach(script => script.remove());
    delete (window as unknown as Record<string, unknown>).testGame;
    jest.restoreAllMocks();
  });

  it('descarga, inicializa una sola vez y permite recuperar una descarga fallida', async () => {
    const entry = { scope: 'testGame', url: 'https://games.example/remoteEntry.js', module: './GameModule' };
    const pending = loadRemoteModule(entry);
    const script = document.querySelector<HTMLScriptElement>('script[data-remote="testGame"]')!;
    expect(script.src).toContain(entry.url);
    script.dispatchEvent(new Event('error'));
    await expect(pending).rejects.toThrow('No se pudo descargar');
    expect(document.querySelector('script[data-remote]')).toBeNull();
    const container = { init: jest.fn().mockResolvedValue(undefined), get: jest.fn().mockResolvedValue(() => ({ GameModule: class {} })) };
    const retry = loadRemoteModule(entry);
    (window as unknown as Record<string, unknown>).testGame = container;
    document.querySelector('script[data-remote]')!.dispatchEvent(new Event('load'));
    expect(await retry).toHaveProperty('GameModule');
    await loadRemoteModule(entry);
    expect(container.init).toHaveBeenCalledTimes(1);
    expect(container.get).toHaveBeenCalledWith('./GameModule');
  });

  it('limpia un script que no registra el contenedor esperado', async () => {
    const pending = loadRemoteModule({ scope: 'testGame', url: 'https://games.example/remoteEntry.js', module: './GameModule' });
    document.querySelector('script[data-remote]')!.dispatchEvent(new Event('load'));
    await expect(pending).rejects.toThrow('no registró');
    expect(document.querySelector('script[data-remote]')).toBeNull();
  });

  it('reintenta la configuracion tras un fallo HTTP y comparte la descarga exitosa', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    globalThis.fetch = fetcher;
    await expect(loadRemotesConfig()).rejects.toThrow('503');
    const first = loadRemotesConfig();
    expect(loadRemotesConfig()).toBe(first);
    await expect(first).resolves.toEqual({});
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
