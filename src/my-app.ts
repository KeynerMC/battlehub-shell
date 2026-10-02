import { route } from '@aurelia/router';
import { resolve } from 'aurelia';
import { IAuthService } from './auth/auth-service';
import { IProfileService } from './profile/profile-service';
import './my-app.css';

@route({
  routes: [
    { path: 'matches', component: import('./pages/matches/matches-page'), title: 'Salas | BattleHub' },
    { path: 'room-play/:roomId', component: import('./pages/play/play-page'), title: 'Partida de prueba | BattleHub' },
    { path: 'lobby', component: import('./pages/lobby/lobby-page'), title: 'Salas de prueba | BattleHub' },
    { path: 'profile', component: import('./pages/profile/profile-page'), title: 'Mi perfil | BattleHub' },
    { path: 'catalog', component: import('./pages/catalog/catalog-page'), title: 'Catálogo | BattleHub' },
    {
      path: 'login',
      component: import('./pages/login/login-page'),
      title: 'Sesión | BattleHub',
    },
    {
      path: ['', 'home'],
      component: import('./pages/home/home-page'),
      title: 'Inicio | BattleHub',
    },
    {
      path: 'play',
      component: import('./pages/play/play-page'),
      title: 'Demo de integración',
    },
  ],
})
export class MyApp {
  public readonly auth = resolve(IAuthService);
  public readonly profiles = resolve(IProfileService);

  public binding(): void {
    if (this.auth.mode === 'auth0' && this.auth.user) void this.retryProfile();
  }

  public async retryProfile(): Promise<void> {
    try { await this.profiles.sync(); }
    catch { /* El servicio publica el error y permite reintentar sin perder el login. */ }
  }
}
