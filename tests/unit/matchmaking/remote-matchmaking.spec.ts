import { RemoteMatchmakingService, parseRoom } from '../../../src/matchmaking/remote-matchmaking-service';
import type { AuthService, SessionUser } from '../../../src/auth/auth-service';

jest.mock('@microsoft/signalr', () => ({}));
describe('Matchmaking real', () => {
  const room = { id: '1', title: 'Sala', gameType: 'typing', createdBy: 'u', createdAt: '2026-10-02T00:00:00Z',
    currentPlayers: 1, maxPlayers: 2, status: 'Waiting', participants: [{ userId: 'u', displayName: 'Ana' }] };
  const originalFetch = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;
  const setup = () => {
    const auth = { user: { id: 'u', displayName: 'Ana' } as SessionUser | null, getAccessToken: jest.fn().mockResolvedValue('test-token') };
    const fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => room });
    globalThis.fetch = fetch;
    AbortSignal.timeout = () => new AbortController().signal;
    return { auth, fetch, service: new RemoteMatchmakingService(auth as unknown as AuthService, 'http://localhost:5211') };
  };
  afterEach(() => { globalThis.fetch = originalFetch; AbortSignal.timeout = originalTimeout; });
  it('envía token y campos del contrato al crear, sin confiar en userId enviado por el navegador', async () => {
    const { service, fetch } = setup();
    expect(await service.create('Sala', 'typing', 2)).toEqual(room);
    expect(fetch).toHaveBeenCalledWith('http://localhost:5211/api/matches', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ title: 'Sala', gameType: 'typing', maxPlayers: 2 }),
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }));
  });
  it('usa los endpoints oficiales y elimina mediante DELETE', async () => {
    const { service, fetch } = setup();
    for (const action of ['join', 'leave', 'start', 'cancel'] as const) {
      await service.action('room/1', action);
      expect(fetch).toHaveBeenLastCalledWith(`http://localhost:5211/api/matches/room%2F1${action === 'cancel' ? '' : '/' + action}`,
        expect.objectContaining({ method: action === 'cancel' ? 'DELETE' : 'POST' }));
    }
  });
  it('finaliza con bearer y acepta 204 sin leer JSON ni enviar body', async () => {
    const { service, fetch, auth } = setup();
    const json = jest.fn();
    fetch.mockResolvedValue({ ok: true, status: 204, json });
    await service.notifyFinished('room/1');
    expect(auth.getAccessToken).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('http://localhost:5211/api/matches/room%2F1/finish', expect.objectContaining({
      method: 'POST', headers: { Authorization: 'Bearer test-token' },
    }));
    expect(fetch.mock.calls[0][1]).not.toHaveProperty('body');
    expect(json).not.toHaveBeenCalled();
  });
  it('sigue leyendo las respuestas JSON de lista y detalle', async () => {
    const { service, fetch } = setup();
    fetch.mockResolvedValueOnce({ ok: true, json: async () => [room] });
    expect(await service.list()).toEqual([room]);
    expect(await service.get('1')).toEqual(room);
  });
  it('descarta respuestas si cambió la sesión', async () => {
    const { service, fetch, auth } = setup();
    fetch.mockImplementation(async () => { auth.user = null; return { ok: true, json: async () => [room] }; });
    await expect(service.list()).rejects.toThrow('sesión cambió');
  });
  it('muestra errores de permisos, concurrencia y dependencias sin detalles del token', async () => {
    const { service, fetch } = setup();
    for (const status of [401, 403, 409, 503]) {
      fetch.mockResolvedValue({ ok: false, status });
      await expect(service.list()).rejects.toThrow();
    }
  });
  it('rechaza DTOs incompatibles y exige configuración explícita', async () => {
    expect(() => parseRoom({ ...room, participants: [{}] })).toThrow('incompatible');
    expect(() => parseRoom({ ...room, status: 'other' })).toThrow('incompatible');
    const { auth } = setup();
    await expect(new RemoteMatchmakingService(auth as unknown as AuthService).list()).rejects.toThrow('MATCHMAKING_SERVICE_URL');
  });


  it.each(['token', 'fetch', 'json'])('rechaza notifyFinished si cambia la sesion durante %s', async stage => {
    const { service, fetch, auth } = setup();
    if (stage === 'token') auth.getAccessToken.mockImplementation(async () => { auth.user = null; return 'token'; });
    if (stage === 'fetch') fetch.mockImplementation(async () => { auth.user = null; return { ok: true, status: 204 }; });
    if (stage === 'json') fetch.mockResolvedValue({ ok: true, status: 200, json: async () => { auth.user = null; return {}; } });
    await expect(service.notifyFinished('room')).rejects.toThrow('sesi\u00f3n cambi\u00f3');
    if (stage === 'token') expect(fetch).not.toHaveBeenCalled();
  });

});
