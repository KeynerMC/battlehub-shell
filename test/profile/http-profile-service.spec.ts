import type { AuthService, SessionUser } from '../../src/auth/auth-service';
import { HttpProfileService } from '../../src/profile/http-profile-service';

describe('Profile Service HTTP (DTOs del Equipo 1)', () => {
  const originalFetch = globalThis.fetch;
  const profile = { id: 'auth0|ana', displayName: 'Ana', email: 'ana@example.test', createdAt: '2026-10-01T00:00:00Z', lastLoginAt: '2026-10-01T00:00:00Z' };
  let auth: AuthService & { user: SessionUser | null };
  let fetchMock: jest.Mock;
  let service: HttpProfileService;
  const response = (json: unknown, status = 200) => ({ ok: status < 400, status, json: async () => json });

  beforeEach(() => {
    auth = {
      mode: 'auth0', error: '', user: { id: profile.id, displayName: 'Ana', email: profile.email },
      initialize: jest.fn(), signIn: jest.fn(), signOut: jest.fn(), getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
    };
    fetchMock = jest.fn(async (url: string) => {
      if (url.endsWith('/permissions')) return response({ permissions: ['games.typing.play'] });
      if (url.endsWith('/games')) return response([{ gameType: 'typing', name: 'Typing Battle', requiredPermission: 'games.typing.play' }]);
      return response(profile);
    });
    globalThis.fetch = fetchMock;
    service = new HttpProfileService(auth, 'http://localhost:5220');
  });
  afterEach(() => { globalThis.fetch = originalFetch; jest.useRealTimers(); });

  it('sincroniza una sola vez para peticiones simultáneas y usa Bearer en los cuatro endpoints', async () => {
    const [me, games, permissions] = await Promise.all([service.getProfile(), service.getEnabledGames(), service.getPermissions()]);
    expect(me).toEqual(profile);
    expect(games).toEqual([{ gameType: 'typing', name: 'Typing Battle', requiredPermission: 'games.typing.play', description: '' }]);
    expect(permissions).toEqual(['games.typing.play']);
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      'http://localhost:5220/api/profiles/sync', 'http://localhost:5220/api/profiles/me',
      'http://localhost:5220/api/profiles/me/permissions', 'http://localhost:5220/api/profiles/me/games',
    ]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ displayName: 'Ana', email: profile.email });
    for (const [, options] of fetchMock.mock.calls) expect(options.headers.Authorization).toBe('Bearer test-access-token');
    expect(service.status).toBe('ready');
  });

  it.each([401, 403, 404, 500])('muestra error %s sin borrar el login y permite reintentar', async status => {
    fetchMock.mockResolvedValueOnce(response({ detail: 'sensitive-server-detail' }, status));
    await expect(service.getProfile()).rejects.toThrow();
    expect(auth.user).not.toBeNull();
    expect(service.status).toBe('error');
    expect(service.error).not.toContain('sensitive-server-detail');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(service.getProfile()).resolves.toEqual(profile);
    expect(service.error).toBe('');
  });

  it('rechaza DTOs incompatibles y perfiles de otro usuario', async () => {
    fetchMock.mockResolvedValueOnce(response(profile)).mockResolvedValueOnce(response({ ...profile, id: 'other-user' }));
    await expect(service.getProfile()).rejects.toThrow('no corresponde');
    fetchMock.mockResolvedValueOnce(response(profile)).mockResolvedValueOnce(response({ id: profile.id }));
    await expect(service.getProfile()).rejects.toThrow('incompatible');
    expect(service.status).toBe('error');
  });

  it('no conserva perfil ni continúa las consultas si se cierra sesión durante sync', async () => {
    let finish: (value: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = service.getProfile();
    // Esperar hasta que la petición HTTP esté pendiente.
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    auth.user = null;
    service.reset();
    finish(response(profile));
    await expect(pending).rejects.toThrow('sesión cambió');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(service.status).toBe('idle');
    await expect(service.getProfile()).rejects.toThrow('Inicia sesión');
  });

  it('maneja errores de red sin usar datos del mock', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(service.getEnabledGames()).rejects.toThrow('conectar');
    expect(service.status).toBe('error');
  });
});
