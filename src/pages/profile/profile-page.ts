import { resolve } from 'aurelia';
import { IAuthService } from '../../auth/auth-service';
import { IProfileService } from '../../profile/profile-service';
import type { UserProfile } from '../../profile/profile-models';

export class ProfilePage {
  public readonly auth = resolve(IAuthService);
  private readonly profiles = resolve(IProfileService);
  public profile: UserProfile | null = null;
  public permissions: string[] = [];
  public busy = false;
  public error = '';

  public canLoad(): boolean | string { return this.auth.user ? true : 'login'; }

  public async loading(): Promise<void> {
    this.busy = true;
    this.error = '';
    this.profile = null;
    this.permissions = [];
    const user = this.auth.user;
    try {
      const [profile, permissions] = await Promise.all([this.profiles.getProfile(), this.profiles.getPermissions()]);
      if (this.auth.user !== user) return;
      this.profile = profile;
      this.permissions = permissions;
    }
    catch (error) { this.error = error instanceof Error ? error.message : 'No se pudo cargar el perfil.'; }
    finally { this.busy = false; }
  }
}
