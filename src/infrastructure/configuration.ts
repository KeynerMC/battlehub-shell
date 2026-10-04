export interface ShellConfiguration {
  mode: 'mock' | 'auth0';
  domain?: string;
  clientId?: string;
  audience?: string;
  typingAudience?: string;
  profileServiceUrl?: string;
  matchmakingServiceUrl?: string;
}

export function readConfiguration(values: Record<string, string | undefined>): ShellConfiguration {
  const mode = values.BATTLEHUB_AUTH_MODE?.trim() || 'mock';
  if (mode === 'mock') return { mode };
  if (mode !== 'auth0') throw new Error('BATTLEHUB_AUTH_MODE debe ser mock o auth0.');
  const required = (key: string): string => {
    const value = values[key]?.trim();
    if (!value) throw new Error(`Falta configurar ${key}.`);
    return value;
  };
  const domain = required('AUTH0_DOMAIN');
  if (!/^[a-z0-9]+(?:[.-][a-z0-9-]+)+$/i.test(domain)) {
    throw new Error('AUTH0_DOMAIN debe ser un hostname, sin https:// ni rutas.');
  }
  const clientId = required('AUTH0_CLIENT_ID');
  const audience = required('AUTH0_AUDIENCE');
  let api: URL;
  try { api = new URL(required('PROFILE_SERVICE_URL')); }
  catch { throw new Error('PROFILE_SERVICE_URL debe ser una URL absoluta del servicio.'); }
  if (!['http:', 'https:'].includes(api.protocol) || api.username || api.password || api.search || api.hash || api.pathname !== '/') {
    throw new Error('PROFILE_SERVICE_URL debe contener solo el origen del servicio, sin credenciales ni rutas.');
  }
  let matchmakingServiceUrl: string | undefined;
  if (values.MATCHMAKING_SERVICE_URL?.trim()) {
    let url: URL;
    try { url = new URL(values.MATCHMAKING_SERVICE_URL.trim()); }
    catch { throw new Error('MATCHMAKING_SERVICE_URL debe ser un origen HTTP válido.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('MATCHMAKING_SERVICE_URL debe contener solo el origen del servicio.');
    }
    matchmakingServiceUrl = url.origin;
  }
  return { mode, domain, clientId, audience, profileServiceUrl: api.origin,
    ...(values.AUTH0_TYPING_AUDIENCE?.trim() ? { typingAudience: values.AUTH0_TYPING_AUDIENCE.trim() } : {}),
    ...(matchmakingServiceUrl ? { matchmakingServiceUrl } : {}) };
}

export function loadConfiguration(): ShellConfiguration {
  // Referencias explícitas: dotenv-webpack sustituye únicamente las variables utilizadas.
  return readConfiguration({
    BATTLEHUB_AUTH_MODE: process.env.BATTLEHUB_AUTH_MODE,
    AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
    AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
    AUTH0_TYPING_AUDIENCE: process.env.AUTH0_TYPING_AUDIENCE,
    PROFILE_SERVICE_URL: process.env.PROFILE_SERVICE_URL,
    MATCHMAKING_SERVICE_URL: process.env.MATCHMAKING_SERVICE_URL,
  });
}
