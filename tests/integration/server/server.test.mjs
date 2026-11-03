import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import { once } from 'node:events';
import vm from 'node:vm';
import { createShellServer, readPublicConfiguration, readRemotes } from '../../../src/server/server.mjs';

const real = { BATTLEHUB_AUTH_MODE: 'auth0', AUTH0_DOMAIN: 'tenant.us.auth0.com', AUTH0_CLIENT_ID: 'public-id',
  AUTH0_AUDIENCE: 'https://api.battlehub.local/profile', PROFILE_SERVICE_URL: 'https://profile.example.com',
  MATCHMAKING_SERVICE_URL: 'https://matches.example.com' };

async function serve(t, env = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'battlehub-shell-test-'));
  await writeFile(join(directory, 'index.html'), '<html><body>Shell</body></html>');
  await writeFile(join(directory, 'entry.12345678.bundle.js'), 'console.log("shell");');
  const server = createShellServer({ rootDir: directory, env });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    const closed = new Promise(resolve => server.close(resolve));
    server.closeAllConnections();
    await closed;
    const within = relative(tmpdir(), directory);
    assert.ok(!isAbsolute(within) && !within.startsWith('..') && within.startsWith('battlehub-shell-test-'));
    await rm(directory, { recursive: true, force: true });
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test('publica solo variables permitidas y no expone secretos del entorno', async t => {
  const origin = await serve(t, { ...real, AUTH0_CLIENT_SECRET: 'do-not-publish', DATABASE_PASSWORD: 'private', NODE_ENV: 'development' });
  const response = await fetch(`${origin}/shell-config.js`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const script = await response.text();
  assert.ok(!script.includes('do-not-publish') && !script.includes('private'));
  const sandbox = { window: {} };
  vm.runInNewContext(script, sandbox);
  assert.equal(sandbox.window.__BATTLEHUB_CONFIG__.AUTH0_CLIENT_ID, 'public-id');
  assert.equal(sandbox.window.__BATTLEHUB_CONFIG__.NODE_ENV, undefined);
});

test('la misma aplicacion sirve configuraciones distintas sin recompilar', async t => {
  const first = await serve(t, real);
  const second = await serve(t, { ...real, PROFILE_SERVICE_URL: 'https://another-profile.example.com' });
  assert.match(await (await fetch(`${first}/shell-config.js`)).text(), /https:\/\/profile\.example\.com/);
  assert.match(await (await fetch(`${second}/shell-config.js`)).text(), /https:\/\/another-profile\.example\.com/);
});

test('valida el modo real, urls publicas HTTPS y configuracion de remotes', () => {
  assert.throws(() => readPublicConfiguration({ NODE_ENV: 'production', BATTLEHUB_AUTH_MODE: 'mock' }), /produccion/);
  assert.throws(() => readPublicConfiguration({ NODE_ENV: 'production' }), /produccion/);
  assert.equal(readPublicConfiguration({ ...real, NODE_ENV: 'production' }).BATTLEHUB_AUTH_MODE, 'auth0');
  assert.throws(() => readPublicConfiguration({ BATTLEHUB_AUTH_MODE: 'auth0' }), /Falta/);
  assert.throws(() => readPublicConfiguration({ ...real, PROFILE_SERVICE_URL: 'http://profile.example.com' }), /HTTPS/);
  assert.throws(() => readPublicConfiguration({ ...real, PROFILE_SERVICE_URL: 'https://profile.railway.internal' }), /navegador/);
  assert.throws(() => readPublicConfiguration({ ...real, PROFILE_SERVICE_URL: 'https://user:secret@example.com' }), /credenciales/);
  assert.throws(() => readRemotes({ REMOTES_CONFIG_JSON: '{invalid' }), /JSON/);
  assert.throws(() => readRemotes({ REMOTES_CONFIG_JSON: '[]' }), /objeto/);
  const remote = { trivia: { scope: 'triviaGame', url: 'https://trivia.example.com/remoteEntry.js', module: './GameModule' } };
  assert.deepEqual(readRemotes({ REMOTES_CONFIG_JSON: JSON.stringify(remote) }), remote);
  assert.throws(() => readRemotes({ REMOTES_CONFIG_JSON: JSON.stringify({ trivia: { ...remote.trivia, url: 'http://localhost:4002/remoteEntry.js' } }) }), /HTTPS/);
});

test('responde health y rutas SPA sin convertir recursos ausentes en HTML', async t => {
  const origin = await serve(t);
  assert.equal(await (await fetch(`${origin}/health`)).text(), 'ok');
  assert.match(await (await fetch(`${origin}/catalog`)).text(), /<html>/);
  assert.equal((await fetch(`${origin}/missing.js`)).status, 404);
  assert.equal((await fetch(`${origin}/api/profiles/me`)).status, 404);
  assert.equal((await fetch(`${origin}/.env`)).status, 404);
  assert.equal((await fetch(`${origin}/%2e%2e%5cpackage.json`)).status, 404);
  assert.equal((await fetch(`${origin}/catalog`, { method: 'POST' })).status, 405);
  const head = await fetch(`${origin}/catalog`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const bundle = await fetch(`${origin}/entry.12345678.bundle.js`);
  assert.match(bundle.headers.get('content-type'), /javascript/);
  assert.match(bundle.headers.get('cache-control'), /immutable/);
});

test('sirve remotes reemplazados por entorno en lugar de una URL de ejemplo', async t => {
  const remotes = { memory: { scope: 'memoryGame', url: 'https://memory.example.com/remoteEntry.js', module: './GameModule' } };
  const origin = await serve(t, { REMOTES_CONFIG_JSON: JSON.stringify(remotes) });
  const response = await fetch(`${origin}/remotes.config.json`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), remotes);
});

test('publica la ruta unificada solo si es local al Profile Service', () => {
  assert.equal(readPublicConfiguration({ ...real, PROFILE_ACCESS_PATH: '/api/profiles/me/access' }).PROFILE_ACCESS_PATH, '/api/profiles/me/access');
  assert.throws(() => readPublicConfiguration({ ...real, PROFILE_ACCESS_PATH: 'https://other.example.com/api/profiles/me' }), /PROFILE_ACCESS_PATH/);
});
