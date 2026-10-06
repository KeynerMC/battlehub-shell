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
    return { sdk, auth: new Auth0AuthService(sdk, window.location.origin,
      'https://api.battlehub.local/typing', 'https://api.battlehub.local/trivia', 'https://api.battlehub.local/memory') };
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

  it('selecciona la audiencia de Trivia sin reutilizar la de Typing o Profile', async () => {
    const { sdk, auth } = setup();
    await auth.initialize();
    await auth.getGameAccessToken('trivia');
    expect(sdk.getTokenSilently).toHaveBeenLastCalledWith({ authorizationParams: {
      audience: 'https://api.battlehub.local/trivia', scope: 'openid profile email',
    } });
    sdk.getTokenSilently.mockRejectedValue({ error: 'consent_required' });
    await expect(auth.getGameAccessToken('trivia')).rejects.toThrow('Autorizar Trivia');
    expect(auth.user?.id).toBe('auth0|1');
    await auth.getGameAccessToken('trivia', true);
    expect(sdk.getTokenWithPopup).toHaveBeenCalledWith({ authorizationParams: {
      audience: 'https://api.battlehub.local/trivia', scope: 'openid profile email',
    } });
  });

  it('rechaza Trivia sin audiencia y juegos desconocidos antes de solicitar tokens', async () => {
    const { sdk } = setup();
    const auth = new Auth0AuthService(sdk, window.location.origin, 'typing-api');
    await auth.initialize();
    await expect(auth.getGameAccessToken('trivia')).rejects.toThrow('AUTH0_TRIVIA_AUDIENCE');
    await expect(auth.getGameAccessToken('memory')).rejects.toThrow('AUTH0_MEMORY_AUDIENCE');
    await expect(auth.getGameAccessToken('unknown')).rejects.toThrow('este juego');
    expect(sdk.getTokenSilently).not.toHaveBeenCalled();
    expect(sdk.getTokenWithPopup).not.toHaveBeenCalled();
  });

  it('cierra la sesión con retorno al origen del Shell', async () => {
    const { sdk, auth } = setup();
    await auth.initialize();
    await auth.signOut();
    expect(sdk.logout).toHaveBeenCalledWith({ logoutParams: { returnTo: window.location.origin } });
    expect(auth.user).toBeNull();
  });
  it('usa la audiencia Memory y solicita consentimiento sin cambiar la cuenta', async () => {
    const { sdk, auth } = setup();
    await auth.initialize();
    await auth.getGameAccessToken('memory');
    const options = { authorizationParams: { audience: 'https://api.battlehub.local/memory', scope: 'openid profile email' } };
    expect(sdk.getTokenSilently).toHaveBeenLastCalledWith(options);
    sdk.getTokenSilently.mockRejectedValue({ error: 'consent_required' });
    await expect(auth.getGameAccessToken('memory')).rejects.toThrow('Autorizar Memory');
    expect(auth.user?.id).toBe('auth0|1');
    expect(sdk.getTokenWithPopup).not.toHaveBeenCalled();
    await auth.getGameAccessToken('memory', true);
    expect(sdk.getTokenWithPopup).toHaveBeenCalledWith(options);
  });
});
