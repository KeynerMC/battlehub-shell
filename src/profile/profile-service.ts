import { DI } from 'aurelia';
import type { CatalogGame, UserProfile } from './profile-models';

export interface ProfileService {
  getProfile(): Promise<UserProfile>;
  getEnabledGames(): Promise<CatalogGame[]>;
}

export const IProfileService = DI.createInterface<ProfileService>('IProfileService');
