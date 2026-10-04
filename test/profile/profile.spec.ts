import { DI, Registration } from 'aurelia';
import { IAuthService } from '../../src/auth/auth-service';
import { MockAuthService } from '../../src/auth/mock-auth-service';
import { IProfileService } from '../../src/profile/profile-service';
import { MockProfileService } from '../../src/profile/mock-profile-service';
import { CatalogPage } from '../../src/pages/catalog/catalog-page';
import { ProfilePage } from '../../src/pages/profile/profile-page';
import { loadRemotesConfig } from '../../src/games/remote-loader';

jest.mock('../../src/games/remote-loader', () => ({ loadRemotesConfig: jest.fn().mockResolvedValue({
  demo: { scope: 'demoGame', url: 'http://localhost:4001/remoteEntry.js', module: './GameModule' },
}) }));

describe('Perfil y catálogo simulados', () => {
  function setup() {
    const auth = new MockAuthService();
    const container = DI.createContainer();
    container.register(Registration.instance(IAuthService, auth), Registration.singleton(IProfileService, MockProfileService));
    return { auth, container, profiles: container.get(IProfileService) };
  }

  it('requiere sesión y refleja el usuario actual sin conservar otro perfil', async () => {
    const { auth, container, profiles } = setup();
    const page = container.invoke(ProfilePage);
    expect(page.canLoad()).toBe('login');
    await expect(profiles.getProfile()).rejects.toThrow();
    await auth.signIn('Ana');
    expect(page.canLoad()).toBe(true);
    await page.loading();
    expect(page.profile?.displayName).toBe('Ana');
    await auth.signOut();
    await page.loading();
    expect(page.profile).toBeNull();
    expect(page.error).not.toBe('');
    await auth.signIn('Mario');
    await page.loading();
    expect(page.profile?.displayName).toBe('Mario');
    expect(page.error).toBe('');
    container.dispose();
  });

  it('maneja catálogo, respuesta vacía y fallo sin dejar datos anteriores', async () => {
    const { auth, container, profiles } = setup();
    const page = container.invoke(CatalogPage);
    expect(page.canLoad()).toBe('login');
    await auth.signIn('Ana');
    await page.loading();
    expect(page.games.map(game => game.gameType)).toEqual(['demo', 'typing', 'trivia', 'memory']);
    expect(page.playableGameType).toBe('demo');
    page.query = 'typing';
    expect(page.filteredGames.map(game => game.gameType)).toEqual(['typing']);
    page.query = '';
    page.availability = 'registered';
    expect(page.filteredGames.map(game => game.gameType)).toEqual(['demo']);
    page.availability = 'pending';
    page.category = 'memory';
    expect(page.filteredGames.map(game => game.gameType)).toEqual(['memory']);
    const request = jest.spyOn(profiles, 'getEnabledGames');
    request.mockResolvedValueOnce([]);
    await page.loading();
    expect(page.games).toEqual([]);
    expect(page.error).toBe('');
    request.mockRejectedValueOnce(new Error('Servicio no disponible'));
    await page.loading();
    expect(page.games).toEqual([]);
    expect(page.error).toBe('Servicio no disponible');
    expect(page.busy).toBe(false);
    request.mockRestore();
    container.dispose();
  });

  it('conserva el catálogo cuando falla la configuración del remote sin anunciar disponibilidad', async () => {
    const { auth, container } = setup();
    await auth.signIn('Ana');
    jest.mocked(loadRemotesConfig).mockRejectedValueOnce(new Error('Configuración no disponible'));
    const page = container.invoke(CatalogPage);
    await page.loading();
    expect(page.games).toHaveLength(4);
    expect(page.registeredGames).toEqual([]);
    expect(page.remoteError).not.toBe('');
    expect(page.error).toBe('');
    container.dispose();
  });
});
