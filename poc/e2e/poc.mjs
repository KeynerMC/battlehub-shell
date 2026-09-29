import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const serve = (dir) => {
  const p = spawn('npx', ['webpack', 'serve'], { cwd: `../${dir}`, env: { ...process.env, CI: '1' }, detached: true });
  p.stdout.on('data', () => {}); p.stderr.on('data', () => {});
  return p;
};
const waitUrl = async (url) => { for (let i = 0; i < 120; i++) { try { if ((await fetch(url)).ok) return; } catch {} await sleep(1000); } throw new Error('timeout ' + url); };
const kill = (p) => { if (p?.pid) { try { process.kill(-p.pid); } catch {} } };
process.on('exit', () => { kill(shell); kill(game); });
let game = null;
let shell = null;

const log = [];
shell = serve('shell');
await waitUrl('http://localhost:4000');
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.on('console', m => log.push(`[${m.type()}] ${m.text()}`));
await page.goto('http://localhost:4000');
await page.waitForSelector('[data-testid=lobby]');

// Escenario 1: remote caído -> 3 intentos -> pantalla de error
await page.click('[data-testid=start-match]');
await page.waitForSelector('[data-testid=game-error]', { timeout: 30000 });
const code1 = await page.textContent('[data-testid=error-code]');
await page.screenshot({ path: '01-remote-caido-error.png' });
console.log('E1 error code:', code1);

// Escenario 2: se levanta el remote -> Reintentar -> juego cargado
game = serve('demo-game');
await waitUrl('http://localhost:4001/remoteEntry.js');
await page.click('[data-testid=retry-btn]');
await page.waitForSelector('[data-testid=game-state]', { timeout: 30000 });
await page.waitForFunction(() => document.querySelector('[data-testid=game-state]')?.textContent === 'running');
for (let i = 0; i < 3; i++) await page.click('[data-testid=click-btn]');
const clicks = await page.textContent('[data-testid=clicks]');
const sameDI = await page.evaluate(() => window.__shellDI === window.__remoteDI && !!window.__shellDI);
await page.screenshot({ path: '02-juego-cargado.png' });
console.log('E2 state running, clicks:', clicks, 'Aurelia compartido (misma instancia DI):', sameDI);

// Escenario 3: pause()
await page.click('[data-testid=pause-btn]');
await page.waitForFunction(() => document.querySelector('[data-testid=game-state]')?.textContent === 'paused');
await page.screenshot({ path: '03-pausado.png' });
console.log('E3 state:', await page.textContent('[data-testid=game-state]'));

// Escenario 4: dispose() y volver al lobby
await page.click('[data-testid=exit-btn]');
await page.waitForSelector('[data-testid=lobby]');
await page.screenshot({ path: '04-lobby-tras-dispose.png' });
console.log('E4 volvió al lobby');

// Evidencia de red: ¿el Shell descargó copias de Aurelia desde el remote?
const res = await page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name).filter(n => n.includes(':4001')));
console.log('Recursos pedidos al remote (4001):', res.length, res.map(r => r.split('/').pop()).join(', '));

console.log('--- consola ---\n' + log.filter(l => /shell|demoGame|error|warn/i.test(l)).join('\n'));
await browser.close(); kill(shell); kill(game);
process.exit(0);
