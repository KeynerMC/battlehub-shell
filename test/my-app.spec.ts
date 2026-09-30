import { MyApp } from '../src/my-app';
import { createFixture } from '@aurelia/testing';

describe('my-app', () => {
  it('muestra el menú de navegación', async () => {
    const { getAllBy } = await createFixture(
      '<my-app></my-app>',
      {},
      [MyApp],
    ).started;

    const links = getAllBy('nav a').map(a => a.textContent?.trim());
    expect(links).toEqual(['Welcome', 'About', 'Probar juego']);
  });
});
