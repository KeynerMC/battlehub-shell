import { resolve } from 'aurelia';
import { IAuthService } from '../../auth/auth-service';
import { IProfileService } from '../../profile/profile-service';
import type { UserProfile } from '../../profile/profile-models';
import { permissionLabel } from '../../games/game-presentation';

export class ProfilePage {
  public readonly auth = resolve(IAuthService);
  private readonly profiles = resolve(IProfileService);
  public profile: UserProfile | null = null;
  public permissions: string[] = [];
  public busy = false;
  public error = '';
  public readonly permissionLabel = permissionLabel;

  public get initials(): string {
    return (this.profile?.displayName ?? '').trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  }

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
