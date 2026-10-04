import { RemoteMatchmakingService, parseRoom } from '../../src/matchmaking/remote-matchmaking-service';
import type { AuthService, SessionUser } from '../../src/auth/auth-service';

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
});
