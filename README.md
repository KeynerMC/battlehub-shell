# battlehub-shell

Shell Application de **BattleHub** — Equipo 3 (Grupo 1), curso de Paradigmas, UNA.

El Shell es la aplicación contenedora de la plataforma. La aplicación principal incluye navegación
y una pantalla de prueba que carga el juego demo con Module Federation. Auth0, Profile Service,
Matchmaking y el control de sesión única siguen pendientes.
Contratos: [battlehub-contracts](https://github.com/javiercoulon-public/battlehub-contracts).

## Versiones (ADR-003)

| Herramienta | Versión |
|---|---|
| Node.js | 24 LTS (`>=24.11.0 <25`, ver `.nvmrc`) |
| `aurelia` y `@aurelia/*` | `2.0.0-rc.2` exacta |
| Webpack | 5 |

Los equipos de juegos (4, 5 y 6) deben usar exactamente estas versiones.

## Cómo correrlo localmente

```bash
npm install
npm start          # http://localhost:4000
```

### Probar el juego remoto desde PowerShell

En una terminal, desde la raíz del repositorio:

```powershell
npm.cmd ci
npm.cmd start
```

En una segunda terminal, también desde la raíz:

```powershell
Set-Location poc/demo-game
npm.cmd ci
npm.cmd start
```

El remote escucha en el puerto 4001. En el Shell (puerto 4000), abre **Probar juego**
y pulsa **Cargar demo**. El usuario y la partida son simulados; el componente se descarga
realmente del otro servidor. Comprueba el contador, pausa, reanudación y regreso al lobby.
No arranques `poc/shell` simultáneamente: usa el mismo puerto 4000.

Para comprobar errores, detén el remote antes de cargarlo en una pestaña nueva. El Shell
muestra el error después de los reintentos. Reinicia el remote y pulsa **Reintentar**.

### Configuración de remotes

`config/remotes.local.json` relaciona `gameType` con `scope`, `url` y `module`.
Webpack publica ese archivo como `/remotes.config.json` y el cargador lo consulta al ejecutar.
`tooling/mf-shared.js` mantiene las versiones compartidas con el demo.

El build de producción selecciona `config/remotes.production.json`, cuya URL sigue siendo
un ejemplo y debe reemplazarse antes de desplegar. Para compilar optimizado con el remote local:

```powershell
npm.cmd run build -- --env target=local
```

El contexto y ciclo de vida están en `src/games/game-contracts.ts`. Las páginas no deben
descargar scripts directamente: la pantalla de prueba utiliza `GameHost`.

## Navegación

La ruta inicial y `home` muestran la bienvenida de BattleHub. El enlace «Probar juego»
lleva a `play`, la pantalla de prueba del remote. Las páginas Welcome/About se retiraron.
El encabezado y pie pertenecen al Shell y se mantienen al cambiar de página.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo en el puerto 4000 |
| `npm run build` | Compilación de producción en `dist/` |
| `npm run lint` | ESLint + Stylelint |
| `npm test` | Lint + pruebas unitarias (Jest) |

## Estructura

```text
/src                → código fuente del Shell
/src/games          → contrato, registro, carga y ciclo de vida de juegos
/src/pages/play     → pantalla de integración con contexto simulado
/config             → registro de remotes por ambiente
/tooling            → configuración de dependencias compartidas
/test               → pruebas unitarias
/poc                → prueba de concepto del ADR-003 (Module Federation)
/.github/workflows  → pipeline de CI de la aplicación principal
```

## Convenciones

- Commits en formato semántico (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`...).
- `main` protegida: todo cambio entra por Pull Request con CI en verde y al menos 1 aprobación.
