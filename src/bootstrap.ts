import Aurelia, { Registration } from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { MyApp } from './my-app';
import { IAuthService } from './auth/auth-service';
import { MockAuthService } from './auth/mock-auth-service';
import { IProfileService } from './profile/profile-service';
import { MockProfileService } from './profile/mock-profile-service';
import { IMatchmakingService } from './matchmaking/matchmaking-service';
import { MockMatchmakingService } from './matchmaking/mock-matchmaking-service';
import { loadConfiguration } from './infrastructure/configuration';
import { Auth0AuthService } from './auth/auth0-auth-service';
import { HttpProfileService } from './profile/http-profile-service';

const config = loadConfiguration();
const auth = config.mode === 'auth0' ? Auth0AuthService.create(config) : new MockAuthService();
await auth.initialize();

await Aurelia.register(
  RouterConfiguration,
  Registration.instance(IAuthService, auth),
  config.mode === 'auth0'
    ? Registration.instance(IProfileService, new HttpProfileService(auth, config.profileServiceUrl!))
    : Registration.singleton(IProfileService, MockProfileService),
  Registration.singleton(IMatchmakingService, MockMatchmakingService),
).app(MyApp).start();
