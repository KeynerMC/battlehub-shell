import type { AuthService, SessionUser } from './auth-service';

// Sesión de desarrollo en memoria: no genera tokens ni autoriza peticiones reales.
export class MockAuthService implements AuthService {
  public readonly mode = 'mock' as const;
  public readonly error = '';
  public user: SessionUser | null = null;

  public async initialize(): Promise<void> { /* Sesión de prueba en memoria. */ }

  public async getAccessToken(): Promise<string> {
    throw new Error('El modo demo no emite tokens para APIs reales.');
  }

  public async signIn(displayName: string): Promise<void> {
    const name = displayName.trim();
    if (!name || name.length > 50) {
      throw new Error('Escribe un nombre de entre 1 y 50 caracteres.');
    }
    this.user = { id: 'demo-user', displayName: name };
  }

  public async signOut(): Promise<void> {
    this.user = null;
  }
}
