import { readConfiguration, loadConfiguration } from '../../src/infrastructure/configuration';

describe('Configuración del Shell', () => {
  const real = {
    NODE_ENV: 'development',
    BATTLEHUB_AUTH_MODE: 'auth0', AUTH0_DOMAIN: 'tenant.us.auth0.com',
    AUTH0_CLIENT_ID: 'public-client-id', AUTH0_AUDIENCE: 'test-api',
    PROFILE_SERVICE_URL: 'http://localhost:5220/',
  };
  it('exige HTTPS en producción y permite HTTP solo en loopback de desarrollo', () => {
    for (const key of ['PROFILE_SERVICE_URL', 'MATCHMAKING_SERVICE_URL']) {
      expect(() => readConfiguration({ ...real, [key]: 'http://api.example.com' })).toThrow('HTTPS');
      expect(() => readConfiguration({ ...real, NODE_ENV: 'production', [key]: 'http://localhost:5220' })).toThrow('HTTPS');
      expect(() => readConfiguration({ ...real, NODE_ENV: 'production', PROFILE_SERVICE_URL: 'https://profile.example.com', MATCHMAKING_SERVICE_URL: 'https://matches.example.com' })).not.toThrow();
      for (const host of ['localhost', '127.0.0.1', '[::1]']) {
        expect(() => readConfiguration({ ...real, [key]: `http://${host}:5220` })).not.toThrow();
      }
    }
    expect(() => readConfiguration({ ...real, NODE_ENV: undefined })).toThrow('HTTPS');
    expect(() => readConfiguration({ ...real, PROFILE_SERVICE_URL: 'http://localhost.evil.example' })).toThrow('HTTPS');
  });
  it('conserva el modo demo explícito y valida el modo real sin fallback', () => {
    expect(readConfiguration({})).toEqual({ mode: 'mock' });
    expect(readConfiguration(real).profileServiceUrl).toBe('http://localhost:5220');
    expect(() => readConfiguration({ ...real, AUTH0_CLIENT_ID: '' })).toThrow('AUTH0_CLIENT_ID');
    expect(() => readConfiguration({ BATTLEHUB_AUTH_MODE: 'typo' })).toThrow();
  });
  it('rechaza rutas de API, credenciales y dominios mal formados', () => {
    for (const url of ['http://user:pass@localhost:5220', 'http://localhost:5220/api/profiles', 'javascript:alert(1)']) {
      expect(() => readConfiguration({ ...real, PROFILE_SERVICE_URL: url })).toThrow();
    }
    expect(() => readConfiguration({ ...real, AUTH0_DOMAIN: 'https://tenant.auth0.com' })).toThrow();
  });
  it('no incluye audiencias por juego en la configuracion del Shell', () => {
    const config = readConfiguration({ ...real, AUTH0_TYPING_AUDIENCE: 'typing-api' });
    expect(config).not.toHaveProperty('typingAudience');
  });

  it('acepta configuracion publica al arrancar y rechaza valores invalidos', () => {
    const previous = process.env.BATTLEHUB_AUTH_MODE;
    try {
      process.env.BATTLEHUB_AUTH_MODE = 'invalid-build-setting';
      window.__BATTLEHUB_CONFIG__ = { BATTLEHUB_AUTH_MODE: 'mock', NODE_ENV: 'development' };
      expect(loadConfiguration()).toEqual({ mode: 'mock' });
      window.__BATTLEHUB_CONFIG__ = { BATTLEHUB_AUTH_MODE: null };
      expect(() => loadConfiguration()).toThrow('debe ser texto');
      window.__BATTLEHUB_CONFIG__ = [];
      expect(() => loadConfiguration()).toThrow('invalida');
    } finally {
      delete window.__BATTLEHUB_CONFIG__;
      if (previous === undefined) delete process.env.BATTLEHUB_AUTH_MODE;
      else process.env.BATTLEHUB_AUTH_MODE = previous;
    }
  });
});
