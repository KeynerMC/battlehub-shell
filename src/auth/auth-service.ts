import { DI } from 'aurelia';

// Contrato interno del Shell, no un DTO de Profile ni un contrato de Auth0.
export interface SessionUser {
  readonly id: string;
  readonly displayName: string;
  readonly email?: string;
}

export interface AuthService {
  readonly mode: 'mock' | 'auth0';
  readonly error: string;
  readonly user: SessionUser | null;
  initialize(): Promise<void>;
  getAccessToken(): Promise<string>;
  getGameAccessToken?(gameType: string, interactive?: boolean): Promise<string>;
  signIn(displayName: string): Promise<void>;
  signOut(): Promise<void>;
}

export const IAuthService = DI.createInterface<AuthService>('IAuthService');
