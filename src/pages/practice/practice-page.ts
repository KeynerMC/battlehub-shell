import { resolve, watch } from 'aurelia';
import { IRouter, type Params } from '@aurelia/router';
import { IAuthService } from '../../auth/auth-service';
import { IProfileService } from '../../profile/profile-service';
import type { GameHost } from '../../games/game-host';
import type { PracticeContext } from '../../games/game-contracts';

export class PracticePage {
  private readonly auth = resolve(IAuthService);
  private readonly profiles = resolve(IProfileService);
  private readonly router = resolve(IRouter);
  public host?: GameHost;
  public context?: PracticeContext;
  public gameName = '';
  public error = '';
  public busy = false;
  private active = true;

  public async canLoad(params: Params = {}): Promise<boolean | string> {
    if (!this.auth.user) return 'login';
    const user = this.auth.user;
    this.context = undefined;
    this.error = '';
    try {
      const games = await this.profiles.getEnabledGames();
      const permissions = await this.profiles.getPermissions();
      if (this.auth.user !== user) return 'login';
      const game = games.find(item => item.gameType === params.gameType);
      if (!game?.requiredPermission || !permissions.includes(game.requiredPermission)) return 'catalog';
      this.gameName = game.name;
      this.context = { mode: 'practice', gameType: game.gameType,
        currentUser: { id: user.id, displayName: user.displayName }, events: new EventTarget() };
    } catch {
      this.error = 'No se pudo comprobar tu acceso. Vuelve al catalogo y actualiza los juegos.';
    }
    return true;
  }

  public async attached(): Promise<void> { await this.start(); }

  public async start(): Promise<void> {
    if (!this.active || this.busy || !this.host || !this.context) return;
    const user = this.auth.user;
    if (user?.id !== this.context.currentUser.id) return;
    this.busy = true;
    this.error = '';
    try {
      // Revalidar el acceso al iniciar/reintentar sin crear una sala.
      const games = await this.profiles.getEnabledGames();
      const permissions = await this.profiles.getPermissions();
      const game = games.find(item => item.gameType === this.context?.gameType);
      if (!this.active || this.auth.user !== user) return;
      if (!game?.requiredPermission || !permissions.includes(game.requiredPermission)) {
        await this.host.exit();
        this.context = undefined;
        this.error = 'Ya no tienes acceso a este juego.';
        return;
      }
      this.host.context = this.context;
      await this.host.load();
    } catch { this.error = 'No se pudo iniciar la practica. Intenta nuevamente.'; }
    finally { this.busy = false; }
  }

  public onExit = (): void => {
    if (this.active && !this.busy) void this.router.load('catalog').catch(() => { this.error = 'Usa el menu Juegos para volver al catalogo.'; });
  };

  @watch((page: PracticePage) => page.auth.user)
  public sessionChanged(): void {
    if (this.context && this.context.currentUser.id !== this.auth.user?.id) {
      this.context = undefined;
      void this.host?.exit().catch(() => { this.error = 'No se pudo cerrar la practica.'; });
    }
  }

  public async detaching(): Promise<void> {
    this.active = false;
    await this.host?.exit();
    this.context = undefined;
  }
}
