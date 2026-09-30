import { DI } from 'aurelia';

// Contrato interno del Shell, no un DTO de Profile ni un contrato de Auth0.
export interface SessionUser {
  readonly id: string;
  readonly displayName: string;
}

export interface AuthService {
  readonly user: SessionUser | null;
  signIn(displayName: string): Promise<void>;
  signOut(): Promise<void>;
}

export const IAuthService = DI.createInterface<AuthService>('IAuthService');
