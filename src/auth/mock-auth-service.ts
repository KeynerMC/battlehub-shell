import type { AuthService, SessionUser } from './auth-service';

// Sesión de desarrollo en memoria: no genera tokens ni autoriza peticiones reales.
export class MockAuthService implements AuthService {
  public user: SessionUser | null = null;

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
