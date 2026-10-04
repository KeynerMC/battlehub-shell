import { DI, Registration } from 'aurelia';
import { createFixture } from '@aurelia/testing';
import { IAuthService } from '../../src/auth/auth-service';
import { IProfileService } from '../../src/profile/profile-service';
import { IRemoteMatchmaking, type RemoteRoom } from '../../src/matchmaking/remote-matchmaking-service';
import { MatchesPage } from '../../src/pages/matches/matches-page';
import template from '../../src/pages/matches/matches-page.html';
import { CustomElement } from 'aurelia';
import { loadRemotesConfig } from '../../src/games/remote-loader';
import { GameHost } from '../../src/games/game-host';

jest.mock('@microsoft/signalr', () => ({ HubConnectionState: { Connected: 'Connected', Disconnected: 'Disconnected' } }));
jest.mock('../../src/games/remote-loader', () => ({ loadRemotesConfig: jest.fn().mockResolvedValue({}) }));

describe('Salas reales', () => {
  beforeEach(() => { jest.mocked(loadRemotesConfig).mockResolvedValue({}); });
  function setup() {
    const connection = { state: 'Connected', start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), invoke: jest.fn().mockResolvedValue(undefined) };
    const rooms: RemoteRoom[] = [{ id: 'room', title: 'Sala de Ana', gameType: 'typing', createdBy: 'u', createdAt: '2026-10-02T00:00:00Z',
      currentPlayers: 2, maxPlayers: 2, status: 'Waiting', participants: [{ userId: 'u', displayName: 'Ana' }, { userId: 'v', displayName: 'Luis' }] }];
    const service = { configured: true, connection: () => connection, list: jest.fn().mockResolvedValue(rooms),
      get: jest.fn().mockResolvedValue(rooms[0]), action: jest.fn().mockResolvedValue(rooms[0]), create: jest.fn().mockResolvedValue(rooms[0]) };
    const auth = { mode: 'auth0', user: { id: 'u', displayName: 'Ana' }, getGameAccessToken: jest.fn().mockResolvedValue('typing-token') };
    const registrations = [Registration.instance(IAuthService, auth),
      Registration.instance(IProfileService, { getPermissions: async () => ['matches.create', 'games.typing.play'] }),
      Registration.instance(IRemoteMatchmaking, service)];
    const container = DI.createContainer().register(...registrations);
    return { page: container.invoke(MatchesPage), service, connection, rooms, registrations, container, auth };
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
  it('entrega a Typing una función de tokens y el sub sin persistir el token en el contexto', async () => {
    const { page, rooms, container, auth } = setup();
    rooms[0].status = 'Started';
    jest.mocked(loadRemotesConfig).mockResolvedValue({ typing: { scope: 'typingGame', url: 'http://localhost:4001/remoteEntry.js', module: './GameModule' } });
    try {
      await page.attached();
      expect(page.context?.currentUser.id).toBe('u');
      expect(await page.context?.getAccessToken?.()).toBe('typing-token');
      expect(auth.getGameAccessToken).toHaveBeenCalledWith('typing');
      expect(JSON.stringify(page.context)).not.toContain('typing-token');
      const provider = page.context!.getAccessToken!;
      auth.user = { id: 'v', displayName: 'Luis' };
      await expect(page.context!.getAccessToken!()).rejects.toThrow('sesión cambió');
      page.onGameExit();
      await expect(provider()).rejects.toThrow('juego se cerró');
    } finally { await page.detaching(); container.dispose(); }
  });
  it('conserva resultados cuando la sala finalizada deja de aparecer en la lista', async () => {
    const { page, rooms, service, container } = setup();
    try {
      await page.attached();
      page.context = { matchId: 'room', gameType: 'typing', currentUser: { id: 'u', displayName: 'Ana' } };
      service.list.mockResolvedValue([]);
      service.get.mockResolvedValue({ ...rooms[0], status: 'Finished' });
      await page.refresh();
      expect(page.gameFinished).toBe(true);
      expect(page.context?.matchId).toBe('room');
      page.onGameExit();
      expect(page.context).toBeUndefined();
    } finally { await page.detaching(); container.dispose(); }
  });
  it('cierra el juego cuando la sala se cancela', async () => {
    const { page, rooms, service, container } = setup();
    try {
      await page.attached();
      page.context = { matchId: 'room', gameType: 'typing', currentUser: { id: 'u', displayName: 'Ana' } };
      service.list.mockResolvedValue([]);
      service.get.mockResolvedValue({ ...rooms[0], status: 'Cancelled' });
      await page.refresh();
      expect(page.context).toBeUndefined();
      expect(page.gameFinished).toBe(false);
    } finally { await page.detaching(); container.dispose(); }
  });
  it('espera consentimiento y revalida la sala después del popup', async () => {
    const { page, rooms, service, container, auth } = setup();
    rooms[0].status = 'Started';
    jest.mocked(loadRemotesConfig).mockResolvedValue({ typing: { scope: 'typingGame', url: 'http://localhost:4001/remoteEntry.js', module: './GameModule' } });
    auth.getGameAccessToken.mockRejectedValueOnce(new Error('Autorizar Typing'));
    try {
      await page.attached();
      expect(page.pendingGame?.id).toBe('room');
      expect(page.context).toBeUndefined();
      service.get.mockResolvedValue({ ...rooms[0], status: 'Cancelled' });
      await page.authorizeGame();
      expect(auth.getGameAccessToken).toHaveBeenLastCalledWith('typing', true);
      expect(page.context).toBeUndefined();
      expect(page.gameMessage).toContain('partida cambió');
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
