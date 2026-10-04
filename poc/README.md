# Prueba de concepto — ADR-003 (Module Federation + Aurelia 2)

Evidencia del ADR-003 de `battlehub-contracts`: un **Shell** (host) carga en tiempo de ejecución un
**juego de prueba** (`demoGame`, remote) con Webpack 5 Module Federation, ambos en Aurelia `2.0.0-rc.2`.

| Carpeta | Qué es | Puerto |
|---|---|---|
| `shell/` | Host. Lee `remotes.config.json`, carga el remote, invoca `initialize/start/pause/dispose` y muestra la pantalla de error | 4000 |
| `demo-game/` | Remote. Expone `./GameModule` (implementa la interfaz `GameModule`) | 4004 |
| `e2e/` | Script de Playwright que ejecuta los 4 escenarios y toma las capturas | — |

## Requisitos

- Node **24 LTS** (`.nvmrc`)

## Cómo correrlo a mano

```bash
cd demo-game && npm install && npm start     # terminal 1 -> http://localhost:4004
cd shell && npm install && npm start         # terminal 2 -> http://localhost:4000
```

Abrir http://localhost:4000 y presionar **Simular MatchStarted**.
Para ver la pantalla de error, detener `demo-game` (Ctrl+C) antes de presionar el botón.

## Escenarios automatizados (evidencia)

```bash
cd e2e && npm install && npx playwright install chromium && npm run poc
```

1. Remote apagado → 3 intentos → pantalla de error `REMOTE_UNREACHABLE` (`evidencias/01-remote-caido-error.png`)
2. Se enciende el remote → "Reintentar" → juego cargado y funcional (`evidencias/02-juego-cargado.png`)
3. `pause()` (`evidencias/03-pausado.png`)
4. `dispose()` y regreso al lobby (`evidencias/04-lobby-tras-dispose.png`)

Además verifica que Aurelia es una sola instancia compartida (mismo contenedor DI en Shell y juego).

## Archivos clave

- `*/mf-shared.js` — dependencias compartidas (versión exacta de Aurelia, `singleton`, `strictVersion`)
- `shell/src/remote-loader.ts` — carga dinámica del contenedor remoto con limpieza para reintentos
- `shell/src/game-host.ts` — ciclo de vida, timeout, reintentos y pantalla de error
- `shell/config/remotes.<ambiente>.json` — URLs por ambiente (`npm run build -- --env target=production`)
