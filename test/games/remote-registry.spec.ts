import { loadGameModule } from '../../src/games/remote-registry';
import { loadRemoteModule, loadRemotesConfig } from '../../src/games/remote-loader';
import { gameArtwork, gamePresentation, permissionLabel, roomStatus } from '../../src/games/game-presentation';
jest.mock('../../src/games/remote-loader');

it('distingue un juego no registrado de una configuracion que falla', async () => {
  jest.mocked(loadRemotesConfig).mockResolvedValueOnce({});
  await expect(loadGameModule('typing')).resolves.toBeNull();
  jest.mocked(loadRemotesConfig).mockRejectedValueOnce(new Error('No disponible'));
  await expect(loadGameModule('typing')).rejects.toMatchObject({ code: 'REMOTE_CONFIG_ERROR', retryable: true });
  const entry = { scope: 'typing', url: 'https://games.example/remoteEntry.js', module: './GameModule' };
  jest.mocked(loadRemotesConfig).mockResolvedValueOnce({ typing: entry });
  jest.mocked(loadRemoteModule).mockResolvedValueOnce({ GameModule: class {} });
  await expect(loadGameModule('typing')).resolves.toHaveProperty('GameModule');
  expect(loadRemoteModule).toHaveBeenCalledWith(entry);
});

it('presenta juegos y permisos desconocidos sin inventar acceso ni estados', () => {
  expect(gamePresentation('typing').category).toBe('Velocidad');
  expect(gamePresentation('unknown').category).toBe('Juego');
  expect(gameArtwork('memory')).toBe('art-memory');
  expect(gameArtwork('unknown')).toBe('art-demo');
  expect(roomStatus('Finished')).toBe('Finalizada');
  expect(roomStatus('Unknown')).toBe('Unknown');
  expect(permissionLabel('games.trivia.play')).toBe('Jugar Trivia Battle');
  expect(permissionLabel('unknown')).toBe('Acceso adicional');
});
