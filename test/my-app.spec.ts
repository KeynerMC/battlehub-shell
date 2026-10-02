import { MyApp } from '../src/my-app';
import { createFixture } from '@aurelia/testing';
import { Registration } from 'aurelia';
import { IAuthService } from '../src/auth/auth-service';
import { MockAuthService } from '../src/auth/mock-auth-service';
import { IProfileService } from '../src/profile/profile-service';
import { MockProfileService } from '../src/profile/mock-profile-service';

describe('my-app', () => {
  it('muestra el menú de navegación', async () => {
    const { getAllBy } = await createFixture(
      '<my-app></my-app>',
      {},
      [MyApp, Registration.singleton(IAuthService, MockAuthService), Registration.singleton(IProfileService, MockProfileService)],
    ).started;

    const links = getAllBy('nav a').map(a => a.textContent?.trim());
    expect(links).toEqual(['Inicio', 'Mi perfil', 'Juegos', 'Salas', 'Probar juego', 'Sesión de prueba']);
  });
});
