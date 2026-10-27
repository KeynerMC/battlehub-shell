declare global {
  interface Window { __BATTLEHUB_CONFIG__?: unknown }
}

const publicKeys = ['BATTLEHUB_AUTH_MODE', 'AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_AUDIENCE',
  'PROFILE_SERVICE_URL', 'MATCHMAKING_SERVICE_URL'] as const;

export interface ShellConfiguration {
  mode: 'mock' | 'auth0';
  domain?: string;
  clientId?: string;
  audience?: string;
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
  const requireSecureTransport = (url: URL, key: string): void => {
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(values.NODE_ENV === 'development' && loopback && url.protocol === 'http:')) {
      throw new Error(`${key} requiere HTTPS; HTTP solo se permite en localhost durante desarrollo.`);
    }
  };
  let api: URL;
  try { api = new URL(required('PROFILE_SERVICE_URL')); }
  catch { throw new Error('PROFILE_SERVICE_URL debe ser una URL absoluta del servicio.'); }
  if (!['http:', 'https:'].includes(api.protocol) || api.username || api.password || api.search || api.hash || api.pathname !== '/') {
    throw new Error('PROFILE_SERVICE_URL debe contener solo el origen del servicio, sin credenciales ni rutas.');
  }
  requireSecureTransport(api, 'PROFILE_SERVICE_URL');
  let matchmakingServiceUrl: string | undefined;
  if (values.MATCHMAKING_SERVICE_URL?.trim()) {
    let url: URL;
    try { url = new URL(values.MATCHMAKING_SERVICE_URL.trim()); }
    catch { throw new Error('MATCHMAKING_SERVICE_URL debe ser un origen HTTP válido.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('MATCHMAKING_SERVICE_URL debe contener solo el origen del servicio.');
    }
    requireSecureTransport(url, 'MATCHMAKING_SERVICE_URL');
    matchmakingServiceUrl = url.origin;
  }
  return { mode, domain, clientId, audience, profileServiceUrl: api.origin,
    ...(matchmakingServiceUrl ? { matchmakingServiceUrl } : {}) };
}

export function loadConfiguration(): ShellConfiguration {
  // Referencias explícitas: dotenv-webpack sustituye únicamente las variables utilizadas.
  const values: Record<string, string | undefined> = {
    NODE_ENV: process.env.NODE_ENV,
    BATTLEHUB_AUTH_MODE: process.env.BATTLEHUB_AUTH_MODE,
    AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
    AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
    PROFILE_SERVICE_URL: process.env.PROFILE_SERVICE_URL,
    MATCHMAKING_SERVICE_URL: process.env.MATCHMAKING_SERVICE_URL,
  };
  const runtime = window.__BATTLEHUB_CONFIG__;
  if (runtime !== undefined) {
    if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) {
      throw new Error('La configuracion publica del Shell es invalida.');
    }
    for (const key of publicKeys) {
      if (Object.prototype.hasOwnProperty.call(runtime, key)) {
        const value = (runtime as Record<string, unknown>)[key];
        if (typeof value !== 'string') throw new Error(`La variable ${key} debe ser texto.`);
        values[key] = value;
      }
    }
  }
  const config = readConfiguration(values);
  if (config.mode === 'auth0' && process.env.NODE_ENV !== 'development' && window.location.protocol !== 'https:') {
    throw new Error('El Shell con Auth0 requiere HTTPS fuera de desarrollo.');
  }
  return config;
}
