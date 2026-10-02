import { resolve } from 'aurelia';
import { IRouter } from '@aurelia/router';
import { IAuthService } from '../../auth/auth-service';

export class LoginPage {
  public readonly auth = resolve(IAuthService);
  private readonly router = resolve(IRouter);
  public displayName = '';
  public error = '';
  public busy = false;

  public async signIn(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      await this.auth.signIn(this.displayName);
      await this.router.load('home');
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo iniciar la sesión de prueba.';
    } finally {
      this.busy = false;
    }
  }

  public async signOut(): Promise<void> {
    await this.auth.signOut();
    this.displayName = '';
    this.error = '';
  }
}
