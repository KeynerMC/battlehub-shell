import { route } from '@aurelia/router';
import './my-app.css';

@route({
  routes: [
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
}
