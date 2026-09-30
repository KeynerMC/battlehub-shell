import { resolve } from 'aurelia';
import { IAuthService } from '../auth/auth-service';
import type { ProfileService } from './profile-service';
import type { CatalogGame, UserProfile } from './profile-models';

export class MockProfileService implements ProfileService {
  private readonly auth = resolve(IAuthService);

  public async getProfile(): Promise<UserProfile> {
    const user = this.auth.user;
    if (!user) throw new Error('Entra en una sesión de prueba para continuar.');
    return { ...user };
  }

  public async getEnabledGames(): Promise<CatalogGame[]> {
    await this.getProfile();
    return [
      { gameType: 'demo', name: 'Demo BattleHub', description: 'Contador para probar la integración de un juego remoto.' },
      { gameType: 'typing', name: 'Typing Battle', description: 'Juego de escritura del Grupo 2.' },
      { gameType: 'trivia', name: 'Trivia Battle', description: 'Juego de preguntas del Grupo 5.' },
      { gameType: 'memory', name: 'Memory Match', description: 'Juego de memoria del Grupo 4.' },
    ];
  }
}
