import type { AuthService, SessionUser } from '../auth/auth-service';
import { ApiClient } from '../infrastructure/api-client';
import type { ProfileService } from './profile-service';
import type { UserProfile, CatalogGame } from './profile-models';

interface Snapshot { profile: UserProfile; permissions: string[]; games: CatalogGame[] }

// DTOs contrastados con OAiza/battlehub-profile-service, commit 897c6b2.
export class HttpProfileService implements ProfileService {
  public status: ProfileService['status'] = 'idle';
  public error = '';
  private snapshot: Snapshot | null = null;
  private session: SessionUser | null = null;
  private pending: Promise<void> | null = null;
  private generation = 0;

  public constructor(private readonly auth: AuthService, private readonly origin: string) {}

  public reset(): void {
    this.generation++;
    this.session = null;
    this.snapshot = null;
    this.pending = null;
    this.status = 'idle';
    this.error = '';
  }

  public sync(): Promise<void> {
    const user = this.auth.user;
    if (!user) { this.reset(); return Promise.reject(new Error('Inicia sesión para consultar tu perfil.')); }
    if (this.pending && this.session === user) return this.pending;
    this.reset();
    this.session = user;
    this.status = 'loading';
    const generation = this.generation;
    const current = () => generation === this.generation && this.auth.user === user;
    const assertCurrent = () => { if (!current()) throw new Error('La sesión cambió. Vuelve a cargar el perfil.'); };
    const api = new ApiClient(this.origin, async () => {
      assertCurrent();
      const token = await this.auth.getAccessToken();
      assertCurrent();
      return token;
    });
    this.pending = (async () => {
      try {
        await api.request('/api/profiles/sync', 'POST', {
          displayName: user.displayName, ...(user.email ? { email: user.email } : {}),
        });
        assertCurrent();
        const profile = parseProfile(await api.request('/api/profiles/me'));
        if (profile.id !== user.id) throw new Error('El perfil recibido no corresponde a la sesión actual.');
        const [permissions, games] = await Promise.all([
          api.request('/api/profiles/me/permissions').then(parsePermissions),
          api.request('/api/profiles/me/games').then(parseGames),
        ]);
        assertCurrent();
        this.snapshot = { profile, permissions, games };
        this.status = 'ready';
      } catch (error) {
        if (generation === this.generation) {
          this.snapshot = null;
          this.status = 'error';
          this.error = error instanceof Error ? error.message : 'No se pudo sincronizar tu perfil.';
        }
        throw error;
      } finally {
        if (generation === this.generation) this.pending = null;
      }
    })();
    return this.pending;
  }

  private async read(): Promise<Snapshot> {
    if (!this.auth.user) { this.reset(); throw new Error('Inicia sesión para consultar tu perfil.'); }
    if (!this.snapshot || this.session !== this.auth.user) await this.sync();
    if (!this.snapshot || this.session !== this.auth.user) throw new Error('La sesión cambió. Vuelve a cargar el perfil.');
    return this.snapshot;
  }

  public async getProfile(): Promise<UserProfile> { return { ...(await this.read()).profile }; }
  public async getPermissions(): Promise<string[]> { return [...(await this.read()).permissions]; }
  public async getEnabledGames(): Promise<CatalogGame[]> { return (await this.read()).games.map(game => ({ ...game })); }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Respuesta de Profile Service incompatible.');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Respuesta de Profile Service incompatible.');
  return value;
}
function parseProfile(value: unknown): UserProfile {
  const dto = object(value);
  return { id: string(dto.id), displayName: string(dto.displayName),
    ...(dto.email == null ? {} : { email: string(dto.email) }),
    createdAt: string(dto.createdAt), lastLoginAt: string(dto.lastLoginAt) };
}
function parsePermissions(value: unknown): string[] {
  const dto = object(value);
  if (!Array.isArray(dto.permissions)) throw new Error('Respuesta de permisos incompatible.');
  return dto.permissions.map(string);
}
function parseGames(value: unknown): CatalogGame[] {
  if (!Array.isArray(value)) throw new Error('Respuesta de catálogo incompatible.');
  return value.map(item => {
    const dto = object(item);
    return { gameType: string(dto.gameType), name: string(dto.name),
      requiredPermission: string(dto.requiredPermission), description: '' };
  });
}
