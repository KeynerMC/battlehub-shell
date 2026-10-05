# battlehub-shell

Shell Application de **BattleHub** — Equipo 3 (Grupo 1), curso de Paradigmas, UNA.

El Shell reúne el inicio de sesión con Auth0, el perfil del usuario, el catálogo y las salas
de Matchmaking. Los juegos se cargan mediante Module Federation. También incluye un modo
de demostración con datos en memoria y un juego de prueba.
Contratos: [battlehub-contracts](https://github.com/javiercoulon-public/battlehub-contracts).

La [guía de interfaz](docs/interfaz-shell.md) describe las pantallas, el alcance del rediseño
y las pruebas visuales. Para los equipos de juegos, consultar la
[plantilla de integración con el Shell](docs/plantilla-integracion-juegos.md).

## Activar Auth0 y Profile Service

Consulta [la guía de integración](docs/auth0-profile-integration.md) para configurar el tenant,
Client ID, Audience, URL de la API y callbacks. Por defecto se usa `BATTLEHUB_AUTH_MODE=mock`.
El modo `auth0` permite acceder al perfil, catálogo y salas reales en `/matches`.
El modo `mock` conserva las salas de demostración y el juego demo.

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

El remote escucha en el puerto 4004. En el Shell (puerto 4000), abre **Probar juego**
y entra primero con un nombre en **Sesión de prueba**. Después abre **Probar juego**
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

### Sesión simulada

`src/auth/auth-service.ts` define el servicio interno del Shell. El arranque registra una única
instancia de `MockAuthService` para las páginas y el encabezado. No se generan tokens ni se
consulta Profile; el identificador `demo-user` es solo de prueba. El nombre se valida y se entrega
al juego en `currentUser`. La sesión vive en memoria y se pierde al recargar.

La ruta `play` redirige a `login` si no hay sesión. Para cerrar sesión, abre **Sesión de prueba**
y pulsa **Cerrar sesión de prueba**. Navegar fuera del juego ejecuta la limpieza de su host.
Esta restricción de interfaz no sustituye la autorización de las APIs. El modo real usa
`src/auth/auth0-auth-service.ts` para redirección, callback y tokens del SDK Auth0.

### Perfil y catálogo de prueba

El menú **Mi perfil** muestra el nombre de la sesión y su identificador de prueba.
**Juegos** muestra un catálogo simulado con Demo, Typing, Trivia y Memory. Solo el demo
tiene acceso a la pantalla de juego; los demás indican integración pendiente. El servidor
del demo debe estar encendido para cargarlo. Ambas páginas requieren sesión simulada.

`src/profile/profile-service.ts` define las operaciones internas y `mock-profile-service.ts`
las implementa en memoria, usando el usuario actual. Los modelos de `profile-models.ts`
son modelos internos de presentación. En modo mock no se consulta la API ni se verifican
permisos reales. En modo auth0, `src/profile/http-profile-service.ts` sincroniza el usuario
y traduce los DTOs actuales del Equipo 1. Las páginas manejan carga, error y catálogo vacío.

### Salas simuladas

Entra con un nombre y abre **Salas**. Puedes entrar a la sala de ejemplo (con un participante
ficticio), salir, crear una sala demo y volver a salir. Solo puedes pertenecer a una sala a la vez.
Una sala creada se elimina cuando queda vacía. La navegación conserva las salas en la misma sesión;
recargar o cambiar de sesión reinicia los datos. No hay sincronización entre pestañas o usuarios.

`src/matchmaking/matchmaking-service.ts` define operaciones y modelos internos de la demo.
`mock-matchmaking-service.ts` mantiene los datos en memoria. Las reglas de capacidad y pertenencia
son de esta simulación, no contratos nuevos para el Equipo 2. Aún no hay SignalR ni llamadas
a la API de Matchmaking. El acceso directo al demo sigue en **Probar juego**.

En tu sala, **Iniciar demo de la sala** abre `room-play/:roomId` y carga el remote automáticamente.
El identificador de la sala se entrega como `matchId`, junto al usuario de la sesión. Se valida
la pertenencia antes de abrir y antes de cargar el juego. **Volver al lobby** libera el juego
y regresa a Salas conservando tu participación; **Salir de la sala** sí te retira de ella.
El remote debe estar encendido en el puerto 4004. Si falla, puedes reintentar o volver a las salas.
`prepareGame` es una operación interna del mock, no un contrato HTTP ni un evento MatchStarted
oficial. No cambia el estado de los demás participantes ni inicia una partida multijugador real.

### Scripts disponibles

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

## Pruebas de navegador

Las pruebas del Shell principal están en `e2e/`, separadas de `poc/e2e/`.
Consulta [las instrucciones E2E](e2e/README.md) para ejecutar el recorrido de sesión,
perfil, catálogo, sala, demo y salida, y la recuperación ante un remote inaccesible.
Requieren Chromium de Playwright. El job `build-and-test` también las ejecuta en cada
Pull Request hacia `main` y en los pushes a `main`, después de lint, build y pruebas unitarias.
Instala las dependencias del demo y Chromium automáticamente. Si un E2E falla, el job falla
y conserva las evidencias disponibles durante 7 días como `e2e-failure-evidence` en GitHub Actions.

## Convenciones del repositorio

La integración real con el Equipo 2 se documenta en [Salas y Matchmaking](docs/matchmaking-integration.md).
La nueva ruta es `/matches`; requiere `MATCHMAKING_SERVICE_URL`, MongoDB y ambos servicios en ejecución.

La [integración local con Typing](docs/typing-integration.md) registra su remote en 4001, entrega tokens de usuario para su propia audiencia y conserva la vista de resultados al finalizar. El demo usa ahora 4004. La URL desplegada de Typing está pendiente.

La [integración local de Trivia](docs/trivia-integration.md) registra el remote en 4002, usa `AUTH0_TRIVIA_AUDIENCE` y entrega tokens separados para jugar y validar la sala. La copia de Trivia tiene API/hub, pantalla multijugador, resultados y cola de finalización preparados. Quedan por confirmar el M2M, su mapa en Matchmaking y la prueba conjunta con Auth0 real; los cambios siguen locales.

La [preparación de Memory](docs/memory-integration.md) registra el remote en 4003, añade `AUTH0_MEMORY_AUDIENCE`, autorización y proveedores de tokens, y limita esta versión a dos jugadores. La copia del Equipo 6 todavía necesita usar esos proveedores, autenticar su API/hub, validar la sala y avisar a Matchmaking. La guía detalla las rutas de sus pendientes y la configuración de Auth0.

- Commits en formato semántico (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`...).
- `main` protegida: todo cambio entra por Pull Request con CI en verde y al menos 1 aprobación.
