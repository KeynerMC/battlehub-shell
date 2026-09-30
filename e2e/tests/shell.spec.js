import { test, expect } from '@playwright/test';

async function signIn(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Probar juego', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sesión de prueba' })).toBeVisible();
  await page.getByLabel('Nombre para el demo').fill('Ana E2E');
  await page.getByRole('button', { name: 'Entrar en modo prueba' }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenido a BattleHub' })).toBeVisible();
}

test('sesión, perfil, catálogo, sala, juego y salida', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await signIn(page);
  await expect(page.locator('header')).toContainText('Ana E2E');
  await page.getByRole('link', { name: 'Mi perfil', exact: true }).click();
  await expect(page.locator('main')).toContainText('Ana E2E');
  await page.getByRole('link', { name: 'Ver catálogo de juegos' }).click();
  await expect(page.locator('.catalog-card')).toHaveCount(4);
  await expect(page.getByText('Integración pendiente', { exact: true })).toHaveCount(3);
  await page.getByRole('link', { name: 'Salas', exact: true }).click();
  await page.getByLabel('Nombre de la sala').fill('Sala E2E');
  await page.getByRole('button', { name: 'Crear sala demo' }).click();
  const room = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Sala E2E', exact: true }) });
  await expect(room).toContainText('Ana E2E');
  const startLink = room.getByRole('link', { name: 'Iniciar demo de la sala' });
  const roomId = (await startLink.getAttribute('href')).split('/').pop();
  await startLink.click();
  await expect(page.getByTestId('game-state')).toHaveText('running');
  await expect(page.locator('.demo-game')).toContainText(roomId);
  await expect(page.locator('.demo-game')).toContainText('Ana E2E');
  await page.getByTestId('click-btn').click();
  await expect(page.getByTestId('clicks')).toHaveText('1');
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.getByTestId('game-state')).toHaveText('paused');
  await expect(page.getByTestId('click-btn')).toBeDisabled();
  await page.getByRole('button', { name: 'Reanudar' }).click();
  await expect(page.getByTestId('game-state')).toHaveText('running');
  await page.getByRole('button', { name: 'Volver al lobby', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Salas de prueba' })).toBeVisible();
  await expect(room).toContainText('Ana E2E');
  await expect(page.locator('.demo-game')).toHaveCount(0);
  await room.getByRole('button', { name: 'Salir de la sala' }).click();
  await expect(room).toHaveCount(0);
  await page.getByRole('link', { name: 'Sesión de prueba', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión de prueba' }).click();
  await page.getByRole('link', { name: 'Salas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sesión de prueba' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('remote inaccesible: muestra error y permite reintentar', async ({ page }) => {
  await signIn(page);
  await page.route('**/remoteEntry.js*', route => route.abort());
  await page.getByRole('link', { name: 'Probar juego', exact: true }).click();
  await page.getByTestId('start-match').click();
  await expect(page.getByTestId('error-code')).toHaveText('REMOTE_UNREACHABLE');
  await page.unroute('**/remoteEntry.js*');
  await page.getByTestId('retry-btn').click();
  await expect(page.getByTestId('game-state')).toHaveText('running');
});
