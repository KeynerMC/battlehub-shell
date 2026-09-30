import { route } from '@aurelia/router';
import { resolve } from 'aurelia';
import { IAuthService } from './auth/auth-service';
import './my-app.css';

@route({
  routes: [
    { path: 'room-play/:roomId', component: import('./pages/play/play-page'), title: 'Partida de prueba | BattleHub' },
    { path: 'lobby', component: import('./pages/lobby/lobby-page'), title: 'Salas de prueba | BattleHub' },
    { path: 'profile', component: import('./pages/profile/profile-page'), title: 'Mi perfil | BattleHub' },
    { path: 'catalog', component: import('./pages/catalog/catalog-page'), title: 'Catálogo | BattleHub' },
    {
      path: 'login',
      component: import('./pages/login/login-page'),
      title: 'Sesión de prueba | BattleHub',
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
}
