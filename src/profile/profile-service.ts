import { DI } from 'aurelia';
import type { CatalogGame, UserProfile } from './profile-models';

export interface ProfileService {
  readonly error: string;
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  sync(): Promise<void>;
  reset(): void;
  getProfile(): Promise<UserProfile>;
  getPermissions(): Promise<string[]>;
  getEnabledGames(): Promise<CatalogGame[]>;
}

export const IProfileService = DI.createInterface<ProfileService>('IProfileService');
