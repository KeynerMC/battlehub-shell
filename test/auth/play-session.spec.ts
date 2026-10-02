import { DI, Registration } from 'aurelia';
import { IAuthService } from '../../src/auth/auth-service';
import { MockAuthService } from '../../src/auth/mock-auth-service';
import { PlayPage } from '../../src/pages/play/play-page';
import type { GameHost } from '../../src/games/game-host';
import { IRouter } from '@aurelia/router';
import { IMatchmakingService } from '../../src/matchmaking/matchmaking-service';
import { MockMatchmakingService } from '../../src/matchmaking/mock-matchmaking-service';

describe('Acceso al demo con sesión', () => {
  it('carga el contexto de la sala y regresa sin retirar al participante', async () => {
    const auth = new MockAuthService();
    const load = jest.fn().mockResolvedValue(true);
    const container = DI.createContainer();
    container.register(Registration.instance(IAuthService, auth),
      Registration.singleton(IMatchmakingService, MockMatchmakingService),
      Registration.instance(IRouter, { load } as unknown as IRouter));
    await auth.signIn('Ana');
    const service = container.get(IMatchmakingService);
    const page = container.invoke(PlayPage);
    expect(await page.canLoad({ roomId: 'missing' })).toBe('lobby');
    expect(await page.canLoad({ roomId: 'sample-room' })).toBe('lobby');
    await service.join('sample-room');
    expect(await page.canLoad({ roomId: 'sample-room' })).toBe(true);
    const host = { load: jest.fn().mockResolvedValue(undefined), context: null };
    page.host = host as unknown as GameHost;
    await page.attached();
    expect(page.context).toEqual({ matchId: 'sample-room', gameType: 'demo', currentUser: auth.user });
    expect(host.load).toHaveBeenCalledTimes(1);
    page.onExit();
    expect(load).toHaveBeenCalledWith('lobby');
    expect((await service.list())[0].participants.some(player => player.id === auth.user.id)).toBe(true);
    await service.leave();
    expect(await page.canLoad({ roomId: 'sample-room' })).toBe('lobby');
    container.dispose();
  });

  it('solicita login y entrega al host el usuario de la sesión activa', async () => {
    const auth = new MockAuthService();
    const container = DI.createContainer();
    container.register(Registration.instance(IAuthService, auth),
      Registration.singleton(IMatchmakingService, MockMatchmakingService),
      Registration.instance(IRouter, { load: jest.fn().mockResolvedValue(true) } as unknown as IRouter));
    const page = container.invoke(PlayPage);
    const host = { load: jest.fn().mockResolvedValue(undefined), context: null };
    page.host = host as unknown as GameHost;
    expect(await page.canLoad()).toBe('login');
    await page.startMatch();
    expect(host.load).not.toHaveBeenCalled();
    await auth.signIn('Mario');
    expect(await page.canLoad()).toBe(true);
    await page.startMatch();
    expect(page.context.currentUser).toEqual(auth.user);
    expect(host.context).toBe(page.context);
    expect(host.load).toHaveBeenCalledTimes(1);
    await page.startMatch();
    expect(host.load).toHaveBeenCalledTimes(1);
    await auth.signOut();
    expect(await page.canLoad()).toBe('login');
    container.dispose();
  });
});
