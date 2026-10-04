# Pruebas de navegador del Shell principal

Estas pruebas están separadas de la PoC. Comprueban el flujo con servicios simulados y
un remote real, además de un fallo de red y su reintento. No verifican Auth0 ni backend real.

Desde la raíz del repositorio, en PowerShell:

```powershell
npm.cmd ci
npm.cmd ci --prefix poc/demo-game
Set-Location e2e
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd test
```

Detén previamente cualquier servidor en los puertos 4000 y 4004. Playwright levanta
y cierra ambos servidores automáticamente; no reutiliza procesos existentes.
Para ver el navegador, utiliza `npm.cmd run test:headed`.

Ante un fallo quedan captura y traza en `test-results/` (ignorado por Git).
No interpretar una prueba como aprobada hasta que termine con resultado satisfactorio.

## GitHub Actions

El workflow `../.github/workflows/ci.yml` ejecuta estas pruebas dentro del job requerido
`build-and-test`, después de las pruebas unitarias. Instala Chromium con sus dependencias
de Linux y deja que Playwright administre los dos servidores. No necesita Auth0 ni secretos.

Un fallo bloquea el éxito del job. Las capturas y trazas disponibles se adjuntan como
`e2e-failure-evidence` durante 7 días. Descarga ese artefacto desde la ejecución en Actions.
La configuración rechaza `test.only` en CI para evitar omitir pruebas por accidente.
