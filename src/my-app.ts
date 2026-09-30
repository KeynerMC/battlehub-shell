import { route } from '@aurelia/router';

@route({
  routes: [
    {
      path: ['', 'welcome'],
      component: import('./welcome-page'),
      title: 'Welcome',
    },
    {
      path: 'about',
      component: import('./about-page'),
      title: 'About',
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
