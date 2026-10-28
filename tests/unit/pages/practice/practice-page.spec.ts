import { DI, Registration } from 'aurelia';
import { IRouter } from '@aurelia/router';
import { IAuthService } from '../../../../src/auth/auth-service';
import { MockAuthService } from '../../../../src/auth/mock-auth-service';
import { IProfileService } from '../../../../src/profile/profile-service';
import { PracticePage } from '../../../../src/pages/practice/practice-page';
import type { GameHost } from '../../../../src/games/game-host';

describe('practica sin salas ni resultados', () => {
  function setup() {
    const auth = new MockAuthService();
    const game = { gameType: 'typing', name: 'Typing Battle', description: '', requiredPermission: 'games.typing.play' };
    const profiles = { getEnabledGames: jest.fn().mockResolvedValue([game]), getPermissions: jest.fn().mockResolvedValue(['games.typing.play']) };
    const load = jest.fn().mockResolvedValue(true);
    const container = DI.createContainer();
    // No se registra Matchmaking: la practica debe funcionar sin resolverlo.
    container.register(Registration.instance(IAuthService, auth), Registration.instance(IProfileService, profiles), Registration.instance(IRouter, { load }));
    const page = container.invoke(PracticePage);
    const host = { context: undefined, load: jest.fn().mockResolvedValue(undefined), exit: jest.fn().mockResolvedValue(undefined) };
    page.host = host as unknown as GameHost;
    return { auth, profiles, page, host, load, container };
  }

  it('requiere sesion y permiso incluso al entrar directamente por URL', async () => {
    const { auth, page, profiles, container } = setup();
    expect(await page.canLoad({ gameType: 'typing' })).toBe('login');
    await auth.signIn('Ana');
    expect(await page.canLoad({ gameType: 'unknown' })).toBe('catalog');
    profiles.getPermissions.mockResolvedValue([]);
    expect(await page.canLoad({ gameType: 'typing' })).toBe('catalog');
    expect(page.context).toBeUndefined();
    container.dispose();
  });

  it('inicia con contexto de practica, sin matchId ni token y no persiste un evento final', async () => {
    const { auth, page, host, load, container } = setup();
    await auth.signIn('Ana');
    expect(await page.canLoad({ gameType: 'typing' })).toBe(true);
    await page.attached();
    expect(host.load).toHaveBeenCalledTimes(1);
    expect(host.context).toEqual(page.context);
    expect(page.context).toMatchObject({ mode: 'practice', gameType: 'typing', currentUser: { id: auth.user!.id } });
    expect(page.context).not.toHaveProperty('matchId');
    expect(page.context).not.toHaveProperty('tokenProviders');
    page.context!.events.dispatchEvent(new CustomEvent('battlehub:game-finished', { detail: { gameType: 'typing' } }));
    expect(load).not.toHaveBeenCalled();
    page.onExit();
    expect(load).toHaveBeenCalledWith('catalog');
    await page.detaching();
    expect(host.exit).toHaveBeenCalled();
    expect(page.context).toBeUndefined();
    container.dispose();
  });

  it('no conserva acceso si se retira el permiso antes de iniciar', async () => {
    const { auth, page, profiles, host, container } = setup();
    await auth.signIn('Ana');
    await page.canLoad({ gameType: 'typing' });
    profiles.getPermissions.mockResolvedValue([]);
    await page.start();
    expect(host.load).not.toHaveBeenCalled();
    expect(host.exit).toHaveBeenCalled();
    expect(page.error).toContain('acceso');
    expect(page.context).toBeUndefined();
    container.dispose();
  });

  it('no inicia si la sesion cambia durante la comprobacion de acceso', async () => {
    const { auth, page, profiles, host, container } = setup();
    await auth.signIn('Ana');
    await page.canLoad({ gameType: 'typing' });
    profiles.getEnabledGames.mockImplementationOnce(async () => { await auth.signOut(); return []; });
    await page.start();
    expect(host.load).not.toHaveBeenCalled();
    page.sessionChanged();
    expect(page.context).toBeUndefined();
    expect(host.exit).toHaveBeenCalled();
    container.dispose();
  });

  it('muestra fallo de Profile y permite reintentar el inicio del host', async () => {
    const { auth, page, profiles, host, container } = setup();
    await auth.signIn('Ana');
    profiles.getEnabledGames.mockRejectedValueOnce(new Error('Profile caido'));
    expect(await page.canLoad({ gameType: 'typing' })).toBe(true);
    expect(page.error).toContain('comprobar');
    await page.start();
    expect(host.load).not.toHaveBeenCalled();
    await page.canLoad({ gameType: 'typing' });
    host.load.mockRejectedValueOnce(new Error('Fallo del host'));
    await page.start();
    expect(page.error).toContain('iniciar');
    await page.start();
    expect(page.error).toBe('');
    await page.detaching();
    await page.start();
    expect(host.load).toHaveBeenCalledTimes(2);
    container.dispose();
  });

  it('descarta el acceso si cambia la cuenta antes de recibir el catalogo', async () => {
    const { auth, page, profiles, container } = setup();
    await auth.signIn('Ana');
    profiles.getEnabledGames.mockImplementationOnce(async () => { await auth.signOut(); return []; });
    expect(await page.canLoad({ gameType: 'typing' })).toBe('login');
    expect(page.context).toBeUndefined();
    container.dispose();
  });
});
