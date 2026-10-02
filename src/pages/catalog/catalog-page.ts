import { resolve } from 'aurelia';
import { IAuthService } from '../../auth/auth-service';
import { IProfileService } from '../../profile/profile-service';
import type { CatalogGame } from '../../profile/profile-models';
import { gameArtwork, gamePresentation } from '../../games/game-presentation';
import { loadRemotesConfig } from '../../games/remote-loader';

export class CatalogPage {
  public readonly auth = resolve(IAuthService);
  private readonly profiles = resolve(IProfileService);
  public games: CatalogGame[] = [];
  public busy = false;
  public error = '';
  public query = '';
  public category = 'all';
  public availability = 'all';
  public remoteError = '';
  public registeredGames: string[] = [];
  public readonly artwork = gameArtwork;
  public readonly presentation = gamePresentation;

  public isRegistered(gameType: string): boolean {
    return this.registeredGames.includes(gameType) && (this.auth.mode === 'auth0' || gameType === 'demo');
  }

  public get filteredGames(): CatalogGame[] {
    const query = this.query.trim().toLocaleLowerCase();
    return this.games.filter(game => (!query || game.name.toLocaleLowerCase().includes(query)) &&
      (this.category === 'all' || game.gameType === this.category) &&
      (this.availability === 'all' || this.isRegistered(game.gameType) === (this.availability === 'registered')));
  }

  // Solo existe una pantalla de partida demo; no anunciar integración de juegos reales.
  public readonly playableGameType = 'demo';

  public canLoad(): boolean | string { return this.auth.user ? true : 'login'; }

  public async loading(): Promise<void> {
    this.busy = true;
    this.error = '';
    this.games = [];
    this.registeredGames = [];
    this.remoteError = '';
    const user = this.auth.user;
    try {
      const games = await this.profiles.getEnabledGames();
      if (this.auth.user !== user) return;
      this.games = games;
      try {
        const remotes = await loadRemotesConfig();
        if (this.auth.user === user) this.registeredGames = Object.keys(remotes);
      } catch {
        if (this.auth.user === user) this.remoteError = 'No se pudo consultar la configuración de los juegos. Reintenta para comprobar su integración.';
      }
    }
    catch (error) { this.error = error instanceof Error ? error.message : 'No se pudo cargar el catálogo.'; }
    finally { this.busy = false; }
  }
}
