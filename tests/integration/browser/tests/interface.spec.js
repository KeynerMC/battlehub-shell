import { test, expect } from '@playwright/test';

async function enter(page) {
  await page.goto('/login');
  await page.getByLabel('Nombre para el demo').fill('Ana Diseño');
  await page.getByRole('button', { name: 'Entrar en modo prueba' }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo, Ana Diseño' })).toBeVisible();
}

async function navigate(page, route) {
  if (route === 'login') {
    await page.getByRole('button', { name: 'Opciones de sesión' }).click();
    await page.getByRole('link', { name: 'Sesión de prueba', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Sesión de prueba' })).toBeVisible();
    return;
  }
  const names = { home: 'Inicio', catalog: 'Juegos', lobby: 'Salas', profile: 'Mi perfil' };
  await page.getByRole('link', { name: names[route], exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${route}$`));
  await expect(page.locator('main h1').first()).toBeVisible();
}

test('catálogo filtra juegos y diferencia demo de integración pendiente', async ({ page }) => {
  await enter(page);
  await page.getByRole('link', { name: 'Juegos', exact: true }).click();
  await expect(page.locator('.catalog-card')).toHaveCount(4);
  await page.getByRole('button', { name: 'Memoria', exact: true }).click();
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  await expect(page.locator('.catalog-card')).toContainText('Memory Match');
  await page.getByRole('button', { name: 'Todos', exact: true }).click();
  await page.getByLabel('Integración').selectOption('registered');
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  await expect(page.locator('.catalog-card')).toContainText('Demo disponible');
  await page.getByLabel('Buscar juego').fill('No existe');
  await expect(page.getByRole('heading', { name: 'No encontramos ese juego' })).toBeVisible();
});

test('menú de cuenta cierra sesión y protege el perfil', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: 'Opciones de sesión' }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByRole('link', { name: 'Mi perfil', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sesión de prueba' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('Ana Diseño');
});

test('pantallas de escritorio y móvil mantienen el contenido dentro de la ventana', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Domina la arena en BattleHub' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('bienvenida.png'), fullPage: true });
  await enter(page);
  for (const route of ['home', 'catalog', 'lobby', 'profile', 'login']) {
    await navigate(page, route);
    await page.screenshot({ path: testInfo.outputPath(`${route}-desktop.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['home', 'catalog', 'lobby', 'profile', 'login']) {
    await navigate(page, route);
    const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    await page.screenshot({ path: testInfo.outputPath(`${route}-mobile.png`), fullPage: true });
  }
});
