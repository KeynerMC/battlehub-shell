import { resolve } from 'aurelia';
import { IRouter } from '@aurelia/router';
import { IAuthService } from '../../auth/auth-service';
import { IProfileService } from '../../profile/profile-service';

export class LoginPage {
  public readonly auth = resolve(IAuthService);
  private readonly profiles = resolve(IProfileService);
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
      if (this.auth.mode === 'mock') await this.router.load('home');
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
    } finally {
      this.busy = false;
    }
  }

  public async signOut(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      await this.auth.signOut();
      this.profiles.reset();
      this.displayName = '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo cerrar sesión.';
    } finally { this.busy = false; }
  }
}
