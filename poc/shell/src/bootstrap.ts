import Aurelia, { DI } from 'aurelia';
(window as unknown as Record<string, unknown>).__shellDI = DI; // evidencia: instancia compartida
import { MyApp } from './my-app';
import { GameHost } from './game-host';

Aurelia.register(GameHost).app(MyApp).start();
