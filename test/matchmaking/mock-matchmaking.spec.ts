import { DI, Registration } from 'aurelia';
import { IAuthService } from '../../src/auth/auth-service';
import { MockAuthService } from '../../src/auth/mock-auth-service';
import { MockMatchmakingService } from '../../src/matchmaking/mock-matchmaking-service';

describe('Salas simuladas', () => {
  function setup() {
    const auth = new MockAuthService();
    const container = DI.createContainer();
    container.register(Registration.instance(IAuthService, auth));
    return { auth, container, service: container.invoke(MockMatchmakingService) };
  }

  it('valida sesión y título, crea una sala y la elimina al quedar vacía', async () => {
    const { auth, container, service } = setup();
    await expect(service.list()).rejects.toThrow();
    await auth.signIn('Ana');
    await expect(service.create(' ')).rejects.toThrow();
    await expect(service.create('x'.repeat(61))).rejects.toThrow();
    await service.create(' Mi sala ');
    const rooms = await service.list();
    expect(rooms[1].title).toBe('Mi sala');
    expect(rooms[1].participants[0].displayName).toBe('Ana');
    expect(rooms[1].createdAt).toMatch(/Z$/);
    await expect(service.create('Otra sala')).rejects.toThrow();
    await expect(service.join('sample-room')).rejects.toThrow();
    await service.leave();
    expect((await service.list()).map(room => room.id)).toEqual(['sample-room']);
    await expect(service.join(rooms[1].id)).rejects.toThrow();
    container.dispose();
  });

  it('no duplica participantes ni expone datos mutables y reinicia al cambiar sesión', async () => {
    const { auth, container, service } = setup();
    await auth.signIn('Ana');
    await service.join('sample-room');
    await service.join('sample-room');
    const rooms = await service.list();
    expect(rooms[0].participants).toHaveLength(2);
    rooms[0].participants.splice(0);
    expect((await service.list())[0].participants).toHaveLength(2);
    await service.leave();
    expect((await service.list())[0].participants).toHaveLength(1);
    await service.create('Sala de Ana');
    await auth.signOut();
    await auth.signIn('Mario');
    expect((await service.list()).map(room => room.title)).toEqual(['Sala de ejemplo (simulada)']);
    container.dispose();
  });
});
