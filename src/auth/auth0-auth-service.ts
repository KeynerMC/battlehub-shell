import { Auth0Client } from '@auth0/auth0-spa-js';
import type { AuthService, SessionUser } from './auth-service';
import type { ShellConfiguration } from '../infrastructure/configuration';

type Auth0Sdk = Pick<Auth0Client, 'handleRedirectCallback' | 'checkSession' | 'isAuthenticated' | 'getUser' | 'getTokenSilently' | 'getTokenWithPopup' | 'loginWithRedirect' | 'logout'>;

export class Auth0AuthService implements AuthService {
  public readonly mode = 'auth0' as const;
  public user: SessionUser | null = null;
  public error = '';

  public constructor(private readonly client: Auth0Sdk, private readonly origin: string,
    private readonly typingAudience?: string, private readonly triviaAudience?: string, private readonly memoryAudience?: string) {}

  public static create(config: ShellConfiguration): Auth0AuthService {
    const origin = window.location.origin;
    return new Auth0AuthService(new Auth0Client({
      domain: config.domain!,
      clientId: config.clientId!,
      authorizationParams: {
        audience: config.audience!,
        redirect_uri: origin,
        scope: 'openid profile email',
      },
      cacheLocation: 'memory',
      httpTimeoutInSeconds: 15,
      authorizeTimeoutInSeconds: 15,
    }), origin, config.typingAudience, config.triviaAudience, config.memoryAudience);
  }

  public async initialize(): Promise<void> {
    this.error = '';
    this.user = null;
    const url = new URL(window.location.href);
    const callback = url.searchParams.has('code') || url.searchParams.has('error');
    try {
      if (callback) {
        // El SDK valida state y la transacción PKCE, también ante errores de Auth0.
        await this.client.handleRedirectCallback();
      } else {
        await this.client.checkSession();
      }
      if (await this.client.isAuthenticated()) {
        const user = await this.client.getUser();
        if (!user?.sub) throw new Error('Missing subject');
        this.user = {
          id: user.sub,
          displayName: user.name || user.nickname || user.email || user.sub,
          ...(user.email ? { email: user.email } : {}),
        };
      }
    } catch {
      this.error = 'No se pudo recuperar la sesión. Vuelve a iniciar sesión.';
    } finally {
      if (callback) {
        for (const key of ['code', 'state', 'error', 'error_description', 'error_uri', 'iss']) url.searchParams.delete(key);
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      }
    }
  }

  public async signIn(): Promise<void> {
    this.error = '';
    try { await this.client.loginWithRedirect(); }
    catch { throw new Error('No se pudo abrir el inicio de sesión. Inténtalo de nuevo.'); }
  }

  public async getAccessToken(): Promise<string> {
    if (!this.user) throw new Error('Inicia sesión para consultar tu perfil.');
    try { return await this.client.getTokenSilently(); }
    catch (error) {
      const code = (error as { error?: string })?.error;
      if (['login_required', 'consent_required', 'interaction_required'].includes(code)) {
        this.user = null;
        this.error = 'Tu sesión necesita renovarse. Vuelve a iniciar sesión.';
        throw new Error(this.error);
      }
      throw new Error('No se pudo obtener acceso al servicio. Reintenta o inicia sesión de nuevo.');
    }
  }

  public async getGameAccessToken(gameType: string, interactive = false): Promise<string> {
    const game = gameType === 'typing' ? { name: 'Typing', audience: this.typingAudience, variable: 'AUTH0_TYPING_AUDIENCE' }
      : gameType === 'trivia' ? { name: 'Trivia', audience: this.triviaAudience, variable: 'AUTH0_TRIVIA_AUDIENCE' }
      : gameType === 'memory' ? { name: 'Memory', audience: this.memoryAudience, variable: 'AUTH0_MEMORY_AUDIENCE' } : undefined;
    if (!game) throw new Error('El Shell no dispone de autorización para este juego.');
    if (!game.audience) throw new Error(`Falta configurar ${game.variable} y reiniciar el Shell.`);
    const user = this.user;
    if (!user) throw new Error('Inicia sesión para jugar.');
    const options = { authorizationParams: { audience: game.audience, scope: 'openid profile email' } };
    try {
      const token = interactive
        ? await this.client.getTokenWithPopup(options)
        : await this.client.getTokenSilently(options);
      const identity = await this.client.getUser();
      if (this.user !== user || identity?.sub !== user.id) {
        this.user = null;
        this.error = 'La sesión cambió. Vuelve a iniciar sesión antes de jugar.';
        throw new Error(this.error);
      }
      if (!token) throw new Error('Missing access token');
      return token;
    } catch {
      if (this.user !== user) throw new Error('La sesión cambió. Vuelve a iniciar sesión antes de jugar.');
      throw new Error(`No se pudo autorizar ${game.name}. Pulsa Autorizar ${game.name}, permite la ventana de Auth0 y verifica la API del juego.`);
    }
  }

  public async signOut(): Promise<void> {
    try {
      await this.client.logout({ logoutParams: { returnTo: this.origin } });
      this.user = null;
      this.error = '';
    } catch { throw new Error('No se pudo cerrar sesión. Inténtalo de nuevo.'); }
  }
}
