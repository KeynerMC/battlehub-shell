import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { resolve, relative, extname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const publicKeys = ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_AUDIENCE',
  'PROFILE_SERVICE_URL', 'MATCHMAKING_SERVICE_URL'];
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.map': 'application/json; charset=utf-8' };

function httpsUrl(value, key, originOnly = false) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${key} debe ser una URL HTTPS publica.`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash
    || (originOnly && (url.pathname !== '/' || url.search))) {
    throw new Error(`${key} debe ser una URL HTTPS sin credenciales${originOnly ? ' ni rutas' : ''}.`);
  }
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.railway.internal')) {
    throw new Error(`${key} debe ser accesible desde el navegador del jugador.`);
  }
  return url;
}

export function readPublicConfiguration(env) {
  const config = { BATTLEHUB_AUTH_MODE: env.BATTLEHUB_AUTH_MODE?.trim() || 'mock' };
  if (!['mock', 'auth0'].includes(config.BATTLEHUB_AUTH_MODE)) throw new Error('BATTLEHUB_AUTH_MODE debe ser mock o auth0.');
  if (env.NODE_ENV === 'production' && config.BATTLEHUB_AUTH_MODE !== 'auth0') {
    throw new Error('En produccion se requiere Auth0; el modo mock es solo para pruebas.');
  }
  for (const key of publicKeys) if (env[key] !== undefined) config[key] = env[key].trim();
  if (config.BATTLEHUB_AUTH_MODE === 'auth0') {
    for (const key of publicKeys) if (!config[key]) throw new Error(`Falta configurar ${key}.`);
    if (!/^[a-z0-9]+(?:[.-][a-z0-9-]+)+$/i.test(config.AUTH0_DOMAIN)) throw new Error('AUTH0_DOMAIN debe ser un hostname.');
    httpsUrl(config.PROFILE_SERVICE_URL, 'PROFILE_SERVICE_URL', true);
    httpsUrl(config.MATCHMAKING_SERVICE_URL, 'MATCHMAKING_SERVICE_URL', true);
  }
  if (env.PROFILE_ACCESS_PATH?.trim()) {
    const path = env.PROFILE_ACCESS_PATH.trim();
    if (!/^\/api\/profiles\/[a-z0-9/_-]+$/i.test(path) || path.includes('//')) throw new Error('PROFILE_ACCESS_PATH invalido.');
    config.PROFILE_ACCESS_PATH = path;
  }
  return config;
}

export function readRemotes(env) {
  let value;
  try { value = JSON.parse(env.REMOTES_CONFIG_JSON || '{}'); }
  catch { throw new Error('REMOTES_CONFIG_JSON debe ser JSON valido.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('REMOTES_CONFIG_JSON debe ser un objeto.');
  const entries = [];
  for (const [game, entry] of Object.entries(value)) {
    if (!['typing', 'trivia', 'memory', 'demo'].includes(game) || !entry || typeof entry !== 'object'
      || typeof entry.scope !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(entry.scope)
      || typeof entry.url !== 'string' || typeof entry.module !== 'string' || !entry.module.startsWith('./')) {
      throw new Error('Remote incompatible: usar juego, scope, url y module validos.');
    }
    httpsUrl(entry.url, `Remote ${game}`);
    if (entries.some(([, previous]) => previous.scope === entry.scope)) throw new Error('Los remotes deben tener scopes distintos.');
    entries.push([game, { scope: entry.scope, url: entry.url, module: entry.module }]);
  }
  return Object.fromEntries(entries);
}

export function createShellServer({ rootDir, env = process.env }) {
  const root = realpathSync(rootDir);
  if (!existsSync(resolve(root, 'index.html'))) throw new Error('Falta dist/index.html. Ejecuta npm run build.');
  const publicConfig = readPublicConfiguration(env);
  const remotes = readRemotes(env);
  const configScript = `window.__BATTLEHUB_CONFIG__ = ${JSON.stringify(publicConfig).replaceAll('<', '\\u003c')};`;
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, body, type = 'text/plain; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); send(405, 'Metodo no permitido'); return; }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://shell').pathname); }
    catch { send(400, 'Ruta invalida'); return; }
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) {
      send(404, 'No encontrado'); return;
    }
    if (pathname === '/health') { send(200, 'ok'); return; }
    if (pathname === '/shell-config.js') { send(200, configScript, mime['.js']); return; }
    if (pathname === '/remotes.config.json') { send(200, JSON.stringify(remotes), mime['.json']); return; }
    if (/^\/(api|hubs)(\/|$)/.test(pathname)) { send(404, 'El Shell no es una API de backend'); return; }
    let file = resolve(root, `.${pathname}`);
    if (!extname(pathname)) file = resolve(root, 'index.html');
    try {
      const actual = await realpath(file);
      const within = relative(root, actual);
      if (within.startsWith('..') || isAbsolute(within)) { send(404, 'No encontrado'); return; }
      const type = mime[extname(actual)];
      if (!type) { send(404, 'No encontrado'); return; }
      const body = await readFile(actual);
      if (/\.[a-f0-9]{8,}\.bundle\.js$/.test(actual)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      send(200, body, type);
    } catch { send(404, 'No encontrado'); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const rawPort = process.env.PORT || '8080';
    if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) throw new Error('PORT debe ser un puerto entre 1 y 65535.');
    const rootDir = fileURLToPath(new URL('../dist/', import.meta.url));
    const server = createShellServer({ rootDir });
    server.listen(Number(rawPort), '0.0.0.0', () => console.log(`Shell disponible en el puerto ${rawPort}`));
    const shutdown = () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
