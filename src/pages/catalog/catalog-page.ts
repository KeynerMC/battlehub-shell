import { resolve } from 'aurelia';
import { IAuthService } from '../../auth/auth-service';
import { IProfileService } from '../../profile/profile-service';
import type { CatalogGame } from '../../profile/profile-models';

export class CatalogPage {
  public readonly auth = resolve(IAuthService);
  private readonly profiles = resolve(IProfileService);
  public games: CatalogGame[] = [];
  public busy = false;
  public error = '';

  // Solo existe una pantalla de partida demo; no anunciar integración de juegos reales.
  public readonly playableGameType = 'demo';

  public canLoad(): boolean | string { return this.auth.user ? true : 'login'; }

  public async loading(): Promise<void> {
    this.busy = true;
    this.error = '';
    this.games = [];
    const user = this.auth.user;
    try {
      const games = await this.profiles.getEnabledGames();
      if (this.auth.user === user) this.games = games;
    }
    catch (error) { this.error = error instanceof Error ? error.message : 'No se pudo cargar el catálogo.'; }
    finally { this.busy = false; }
  }
}
