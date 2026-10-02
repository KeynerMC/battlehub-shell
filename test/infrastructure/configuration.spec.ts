import { readConfiguration } from '../../src/infrastructure/configuration';

describe('Configuración del Shell', () => {
  const real = {
    BATTLEHUB_AUTH_MODE: 'auth0', AUTH0_DOMAIN: 'tenant.us.auth0.com',
    AUTH0_CLIENT_ID: 'public-client-id', AUTH0_AUDIENCE: 'test-api',
    PROFILE_SERVICE_URL: 'http://localhost:5220/',
  };
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
});
