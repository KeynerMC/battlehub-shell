import { DI, Registration } from 'aurelia';
import { HomePage } from '../../src/pages/home/home-page';
import { IAuthService } from '../../src/auth/auth-service';
import { IProfileService } from '../../src/profile/profile-service';
import { IRemoteMatchmaking } from '../../src/matchmaking/remote-matchmaking-service';
import { IMatchmakingService } from '../../src/matchmaking/matchmaking-service';

describe('Resumen de inicio', () => {
  function setup() {
    const auth = { mode: 'auth0', user: { id: 'ana', displayName: 'Ana' } as { id: string; displayName: string } | null };
    const profiles = { getEnabledGames: jest.fn().mockResolvedValue([{ gameType: 'typing', name: 'Typing Battle' }]) };
    const service = { list: jest.fn().mockRejectedValue(new Error('Sin conexión')) };
    const mock = { list: jest.fn().mockResolvedValue([]) };
    const container = DI.createContainer().register(Registration.instance(IAuthService, auth),
      Registration.instance(IProfileService, profiles), Registration.instance(IRemoteMatchmaking, service),
      Registration.instance(IMatchmakingService, mock));
    return { auth, profiles, service, mock, container, page: container.invoke(HomePage) };
  }

  it('mantiene el catálogo ante un fallo de salas sin recurrir a datos simulados', async () => {
    const { page, mock, container } = setup();
    try {
      await page.loading();
      expect(page.games).toHaveLength(1);
      expect(page.rooms).toEqual([]);
      expect(page.roomError).not.toBe('');
      expect(page.gameError).toBe('');
      expect(mock.list).not.toHaveBeenCalled();
    } finally { container.dispose(); }
  });

  it('descarta un resumen pendiente si se cierra la sesión', async () => {
    const { page, auth, profiles, container } = setup();
    let complete!: (games: { gameType: string; name: string }[]) => void;
    profiles.getEnabledGames.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    try {
      const loading = page.loading();
      auth.user = null;
      complete([{ gameType: 'typing', name: 'Typing Battle' }]);
      await loading;
      expect(page.games).toEqual([]);
      expect(page.rooms).toEqual([]);
      expect(page.busy).toBe(false);
    } finally { container.dispose(); }
  });
});
