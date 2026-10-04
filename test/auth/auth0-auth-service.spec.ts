import { Auth0AuthService } from '../../src/auth/auth0-auth-service';

jest.mock('@auth0/auth0-spa-js', () => ({ Auth0Client: jest.fn() }));

describe('Adaptador Auth0', () => {
  const setup = () => {
    const sdk = {
      handleRedirectCallback: jest.fn().mockResolvedValue({}), checkSession: jest.fn().mockResolvedValue(undefined),
      isAuthenticated: jest.fn().mockResolvedValue(true), getUser: jest.fn().mockResolvedValue({ sub: 'auth0|1', name: 'Ana' }),
      getTokenSilently: jest.fn().mockResolvedValue('access-token'), loginWithRedirect: jest.fn().mockResolvedValue(undefined),
      getTokenWithPopup: jest.fn().mockResolvedValue('typing-token'),
      logout: jest.fn().mockResolvedValue(undefined),
    };
    return { sdk, auth: new Auth0AuthService(sdk, window.location.origin, 'https://api.battlehub.local/typing') };
  };
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('procesa callback antes de leer usuario y limpia parámetros sensibles', async () => {
    window.history.replaceState(null, '', '/?code=test&state=test&keep=yes');
    const { sdk, auth } = setup();
    await auth.initialize();
    expect(sdk.handleRedirectCallback).toHaveBeenCalledTimes(1);
    expect(sdk.checkSession).not.toHaveBeenCalled();
    expect(auth.user).toEqual({ id: 'auth0|1', displayName: 'Ana' });
    expect(window.location.search).toBe('?keep=yes');
    expect(await auth.getAccessToken()).toBe('access-token');
  });

  it('muestra errores de callback sin exponer la respuesta de Auth0', async () => {
    window.history.replaceState(null, '', '/?error=access_denied&state=test');
    const { sdk, auth } = setup();
    sdk.handleRedirectCallback.mockRejectedValue(new Error('sensitive-provider-detail'));
    await auth.initialize();
    expect(auth.user).toBeNull();
    expect(auth.error).toContain('Vuelve a iniciar sesión');
    expect(auth.error).not.toContain('sensitive');
    expect(window.location.search).toBe('');
  });

  it('recupera sesión y pide login cuando no puede renovar el token', async () => {
    const { sdk, auth } = setup();
    await auth.initialize();
    expect(sdk.checkSession).toHaveBeenCalledTimes(1);
    sdk.getTokenSilently.mockRejectedValue({ error: 'login_required' });
    await expect(auth.getAccessToken()).rejects.toThrow('renovarse');
    expect(auth.user).toBeNull();
    await auth.signIn();
    expect(sdk.loginWithRedirect).toHaveBeenCalledTimes(1);
  });

  it('obtiene tokens separados para el juego sin cambiar el token de Profile', async () => {
    const { sdk, auth } = setup();
    await auth.initialize();
    await auth.getGameAccessToken('typing');
    expect(sdk.getTokenSilently).toHaveBeenLastCalledWith({ authorizationParams: {
      audience: 'https://api.battlehub.local/typing', scope: 'openid profile email',
    } });
    await auth.getAccessToken();
    expect(sdk.getTokenSilently).toHaveBeenLastCalledWith();
  });

  it('conserva la sesión ante consentimiento pendiente y abre popup solo con acción explícita', async () => {
    const { sdk, auth } = setup();
    await auth.initialize();
    const user = auth.user;
    sdk.getTokenSilently.mockRejectedValue({ error: 'consent_required' });
    await expect(auth.getGameAccessToken('typing')).rejects.toThrow('Autorizar Typing');
    expect(auth.user).toBe(user);
    expect(sdk.getTokenWithPopup).not.toHaveBeenCalled();
    expect(await auth.getGameAccessToken('typing', true)).toBe('typing-token');
  });

  it('rechaza el token del popup si el usuario elige otra cuenta', async () => {
    const { sdk, auth } = setup();
    await auth.initialize();
    sdk.getUser.mockResolvedValue({ sub: 'auth0|2', name: 'Otra persona' });
    await expect(auth.getGameAccessToken('typing', true)).rejects.toThrow('sesión cambió');
    expect(auth.user).toBeNull();
  });

  it('no reemplaza la audiencia de un juego ausente con la audiencia de Profile', async () => {
    const { sdk } = setup();
    const auth = new Auth0AuthService(sdk, window.location.origin);
    await auth.initialize();
    await expect(auth.getGameAccessToken('typing')).rejects.toThrow('AUTH0_TYPING_AUDIENCE');
    expect(sdk.getTokenSilently).not.toHaveBeenCalled();
  });

  it('cierra la sesión con retorno al origen del Shell', async () => {
    const { sdk, auth } = setup();
    await auth.initialize();
    await auth.signOut();
    expect(sdk.logout).toHaveBeenCalledWith({ logoutParams: { returnTo: window.location.origin } });
    expect(auth.user).toBeNull();
  });
});
