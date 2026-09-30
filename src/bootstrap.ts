import Aurelia from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { MyApp } from './my-app';

await Aurelia.register(RouterConfiguration).app(MyApp).start();
