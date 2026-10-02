import { DI, Registration } from 'aurelia';
import { createFixture } from '@aurelia/testing';
import { IAuthService } from '../../src/auth/auth-service';
import { IProfileService } from '../../src/profile/profile-service';
import { IRemoteMatchmaking, type RemoteRoom } from '../../src/matchmaking/remote-matchmaking-service';
import { MatchesPage } from '../../src/pages/matches/matches-page';
import template from '../../src/pages/matches/matches-page.html';
import { CustomElement } from 'aurelia';
import { GameHost } from '../../src/games/game-host';

jest.mock('@microsoft/signalr', () => ({ HubConnectionState: { Connected: 'Connected', Disconnected: 'Disconnected' } }));
jest.mock('../../src/games/remote-loader', () => ({ loadRemotesConfig: jest.fn().mockResolvedValue({}) }));

describe('Salas reales', () => {
  function setup() {
    const connection = { state: 'Connected', start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), invoke: jest.fn().mockResolvedValue(undefined) };
    const rooms: RemoteRoom[] = [{ id: 'room', title: 'Sala de Ana', gameType: 'typing', createdBy: 'u', createdAt: '2026-10-02T00:00:00Z',
      currentPlayers: 2, maxPlayers: 2, status: 'Waiting', participants: [{ userId: 'u', displayName: 'Ana' }, { userId: 'v', displayName: 'Luis' }] }];
    const service = { configured: true, connection: () => connection, list: jest.fn().mockResolvedValue(rooms),
      action: jest.fn().mockResolvedValue(rooms[0]), create: jest.fn().mockResolvedValue(rooms[0]) };
    const registrations = [Registration.instance(IAuthService, { mode: 'auth0', user: { id: 'u', displayName: 'Ana' } }),
      Registration.instance(IProfileService, { getPermissions: async () => ['matches.create', 'games.typing.play'] }),
      Registration.instance(IRemoteMatchmaking, service)];
    const container = DI.createContainer().register(...registrations);
    return { page: container.invoke(MatchesPage), service, connection, rooms, registrations, container };
  }
  it('carga permisos y salas; detiene heartbeat y conexión al navegar fuera', async () => {
    const { page, service, connection, container } = setup();
    try {
      await page.attached();
      expect(page.canCreate).toBe(true);
      expect(page.games.map(g => g.gameType)).toEqual(['typing']);
      expect(page.rooms).toHaveLength(1);
      page.title = 'Otra'; page.maxPlayers = 4;
      await page.create();
      expect(service.create).toHaveBeenCalledWith('Otra', 'typing', 4);
      expect(connection.invoke).toHaveBeenCalledWith('Heartbeat', 'room');
    } finally { await page.detaching(); container.dispose(); }
    expect(connection.stop).toHaveBeenCalledTimes(1);
  });
  it('muestra un aviso al iniciar sin remote y no sustituye el juego por demo', async () => {
    const { page, rooms, container } = setup();
    rooms[0].status = 'Started';
    try {
      await page.attached();
      expect(page.gameMessage).toContain('no tiene un remote');
      expect(page.context).toBeUndefined();
    } finally { await page.detaching(); container.dispose(); }
  });
  it('filtra las salas y confirma la cancelación antes de ejecutar la acción', async () => {
    const { page, rooms, service, container } = setup();
    try {
      await page.attached();
      page.query = 'ana';
      expect(page.filteredRooms).toHaveLength(1);
      page.filterGame = 'memory';
      expect(page.filteredRooms).toHaveLength(0);
      page.pendingCancel = rooms[0];
      expect(service.action).not.toHaveBeenCalled();
      await page.confirmCancel();
      expect(service.action).toHaveBeenCalledWith('room', 'cancel');
      expect(page.pendingCancel).toBeUndefined();
    } finally { await page.detaching(); container.dispose(); }
  });
  it('renderiza la plantilla Aurelia con participantes y controles', async () => {
    const { registrations, container } = setup();
    const Component = CustomElement.define({ name: 'matches-test', template }, class extends MatchesPage {});
    const fixture = await createFixture('<matches-test></matches-test>', {}, [Component, GameHost, ...registrations]).started;
    try {
      expect(fixture.appHost.textContent).toContain('Sala de Ana');
      expect(fixture.appHost.textContent).toContain('Luis');
      expect(fixture.appHost.textContent).toContain('Iniciar partida');
    } finally { await fixture.stop(true); container.dispose(); }
  });
});
