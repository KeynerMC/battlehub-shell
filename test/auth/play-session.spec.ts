import { DI, Registration } from 'aurelia';
import { IAuthService } from '../../src/auth/auth-service';
import { MockAuthService } from '../../src/auth/mock-auth-service';
import { PlayPage } from '../../src/pages/play/play-page';
import type { GameHost } from '../../src/games/game-host';

describe('Acceso al demo con sesión', () => {
  it('solicita login y entrega al host el usuario de la sesión activa', async () => {
    const auth = new MockAuthService();
    const container = DI.createContainer();
    container.register(Registration.instance(IAuthService, auth));
    const page = container.invoke(PlayPage);
    const host = { load: jest.fn().mockResolvedValue(undefined), context: null };
    page.host = host as unknown as GameHost;
    expect(page.canLoad()).toBe('login');
    await page.startMatch();
    expect(host.load).not.toHaveBeenCalled();
    await auth.signIn('Mario');
    expect(page.canLoad()).toBe(true);
    await page.startMatch();
    expect(page.context.currentUser).toEqual(auth.user);
    expect(host.context).toBe(page.context);
    expect(host.load).toHaveBeenCalledTimes(1);
    await page.startMatch();
    expect(host.load).toHaveBeenCalledTimes(1);
    await auth.signOut();
    expect(page.canLoad()).toBe('login');
    container.dispose();
  });
});
