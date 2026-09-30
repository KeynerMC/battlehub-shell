import Aurelia, { Registration } from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { MyApp } from './my-app';
import { IAuthService } from './auth/auth-service';
import { MockAuthService } from './auth/mock-auth-service';
import { IProfileService } from './profile/profile-service';
import { MockProfileService } from './profile/mock-profile-service';
import { IMatchmakingService } from './matchmaking/matchmaking-service';
import { MockMatchmakingService } from './matchmaking/mock-matchmaking-service';

await Aurelia.register(
  RouterConfiguration,
  Registration.singleton(IAuthService, MockAuthService),
  Registration.singleton(IProfileService, MockProfileService),
  Registration.singleton(IMatchmakingService, MockMatchmakingService),
).app(MyApp).start();
