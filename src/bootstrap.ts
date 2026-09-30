import Aurelia, { Registration } from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { MyApp } from './my-app';
import { IAuthService } from './auth/auth-service';
import { MockAuthService } from './auth/mock-auth-service';

await Aurelia.register(
  RouterConfiguration,
  Registration.singleton(IAuthService, MockAuthService),
).app(MyApp).start();
