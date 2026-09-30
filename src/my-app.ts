import { route } from '@aurelia/router';
import { resolve } from 'aurelia';
import { IAuthService } from './auth/auth-service';
import './my-app.css';

@route({
  routes: [
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
