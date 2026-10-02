import { resolve } from 'aurelia';
import { IAuthService } from '../../auth/auth-service';

export class HomePage {
  public readonly auth = resolve(IAuthService);
}
