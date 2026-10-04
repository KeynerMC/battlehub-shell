# Integración local con Typing (Equipo 4)

Cambios locales del Shell, revisados el 2026-10-03. No constituyen un despliegue ni aprueban ADR-004 o ADR-007. El frontend de referencia del Equipo 4 está en `feature/conexion`, sin tilde.

## Conexiones

| Componente | Dirección local | Autorización |
|---|---|---|
| Shell | `http://localhost:4000` | Aplicación SPA BattleHub Shell |
| Profile | `http://localhost:5220` | Token de usuario, audiencia `https://api.battlehub.local/profile` |
| Matchmaking | `http://localhost:5211` | Token de usuario con la misma audiencia que Profile |
| Typing frontend | `http://localhost:4001/remoteEntry.js` | Contenedor `typingGame`, módulo `./GameModule` |
| Typing API / hub | `http://localhost:5015`, `/hubs/typing` | Token de usuario, audiencia `https://api.battlehub.local/typing` |
| Demo | `http://localhost:4004/remoteEntry.js` | Sesión simulada, sin token real |

## Auth0 y Shell

En el tenant `dev-jaii1peslxnejq0y.us.auth0.com`, crear o confirmar una API de jugadores llamada BattleHub Typing API con Identifier `https://api.battlehub.local/typing` y algoritmo RS256. La aplicación existente BattleHub Shell sigue siendo la SPA del usuario; no crear otra SPA para el microfrontend. Configurar sus orígenes y callbacks para `http://localhost:4000` y permitirle acceso de usuario a la API de Typing según las políticas de acceso del tenant.

El responsable del Shell confirmó esa API, RS256 y el acceso delegado de BattleHub Shell en el tenant el 2026-10-03. También comunicó que probó el recorrido local con dos usuarios. Esto no certifica un despliegue ni sustituye comprobar el callback M2M en los logs del backend.

Configuración pública del Shell en `.env.development` (para producción, usar `.env` o las variables del proceso de build):

```dotenv
BATTLEHUB_AUTH_MODE=auth0
AUTH0_DOMAIN=dev-jaii1peslxnejq0y.us.auth0.com
AUTH0_CLIENT_ID=0q5Qr4nWzdqSmtEXmAaYT4cBj0K2n9IQ
AUTH0_AUDIENCE=https://api.battlehub.local/profile
AUTH0_TYPING_AUDIENCE=https://api.battlehub.local/typing
PROFILE_SERVICE_URL=http://localhost:5220
MATCHMAKING_SERVICE_URL=http://localhost:5211
```

Reiniciar el Shell después de cambiar variables. `AUTH0_TYPING_AUDIENCE` no reemplaza `AUTH0_AUDIENCE`: cada API recibe su propio token. El Shell consulta primero la caché del SDK o la sesión silenciosa. Si falta consentimiento, muestra **Autorizar Typing**, que abre Auth0 mediante una acción del usuario. No se abre un popup automáticamente ni se almacenan tokens en archivos, URLs o localStorage. El SDK mantiene su caché en memoria.

El uso de audiencia adicional y popup sigue el [SDK oficial de Auth0](https://auth0.github.io/auth0-spa-js/classes/Auth0Client.html). Esta extensión local no cambia el contrato central de GameContext. No se solicita `games.typing.play` como scope de Auth0: actualmente la habilitación del juego se consulta en Profile y el backend de Typing puede exigir usuario autenticado sin un permiso Auth0 adicional. Si se decide exigir ese permiso en la API, los equipos deben coordinar RBAC, asignaciones y scopes solicitados antes de activarlo.

## Qué configura el Equipo 4

- Frontend: `TYPING_API_URL=http://localhost:5015`, puerto 4001 y dependencias compartidas Aurelia `2.0.0-rc.2`.
- API/hub: modo Auth0, dominio del tenant anterior, audiencia `https://api.battlehub.local/typing` y CORS para `http://localhost:4000`. No dejar el modo Development activo para la prueba real.
- Identidad: comprobar que el `sub` del JWT coincide con `currentUser.id`, sin asumir que todos los usuarios tienen prefijo `auth0|` (también existen identidades de Google).
- Finalización: URL de Matchmaking `http://localhost:5211`; dominio del mismo tenant y audiencia `https://api.battlehub.local/profile` para el cliente M2M BattleHub Typing Service. Su Client ID es `8BWcE4T8HxhJrxU1CtgmNkjDOpkrN4Su`; su autorización debe incluir únicamente `matches.finish` sobre esa API. Guardar Client Secret en secretos del backend, nunca en el Shell o frontend.
- Antes de aceptar un jugador, verificar en Matchmaking que la sala está Started, es `typing` y el `sub` pertenece a sus participantes. La verificación del Shell no sustituye esa validación del backend del juego.

Esta última validación todavía requiere acordar cómo autorizar la consulta desde el backend de Typing. El proveedor actual entrega un token con audiencia de Typing, que no sirve para el GET de Matchmaking. Tampoco está autorizado el cliente M2M de finalización para endpoints de usuarios. No desactivar la validación de audiencia: coordinar una delegación de usuario o un endpoint específico de validación para juegos con los Equipos 2 y 4.

## Recorrido para comprobarlo

1. Levantar Profile y Matchmaking con MongoDB, y Typing con su base MySQL y su API en modo Auth0.
2. Levantar el frontend de Typing y ejecutar `npm start` en el Shell. El demo es opcional y ahora usa 4004.
3. Iniciar sesión con dos usuarios con `games.typing.play`; el anfitrión necesita también `matches.create` en Profile.
4. Crear sala con `gameType` `typing`, unirse con el segundo usuario e iniciar. El Shell revalida estado y pertenencia antes de montar el remote.
5. Si aparece Autorizar Typing, aceptar con la misma cuenta del Shell. Una cuenta distinta invalida la sesión local y obliga a iniciar sesión otra vez.
6. Comprobar que REST y `/hubs/typing` aceptan el token; terminar la partida y comprobar persistencia y el callback M2M a Matchmaking.
7. Cuando Matchmaking pasa a Finished, el Shell conserva el juego para mostrar resultados e historial. Cerrar juego libera sus recursos. Una sala cancelada o eliminada cierra el juego.

`config/remotes.production.json` no registra Typing todavía: falta que el Equipo 4 entregue su URL desplegada. No usar la URL de localhost para publicar.

## Archivos modificados y verificación

- Autorización: `src/auth/auth-service.ts`, `src/auth/auth0-auth-service.ts`, `src/infrastructure/configuration.ts`, `.env.example` y el archivo local ignorado `.env.development`.
- Juego y salas: `src/games/game-contracts.ts`, `src/matchmaking/remote-matchmaking-service.ts`, `src/pages/matches/matches-page.ts`, `src/pages/matches/matches-page.html` y `config/remotes.local.json`.
- Puerto del demo: `poc/demo-game/webpack.config.js`, `poc/shell/config/remotes.local.json`, `poc/e2e/poc.mjs`, `poc/README.md`, `e2e/playwright.config.js` y `e2e/README.md`.
- Documentación: `README.md`, `docs/matchmaking-integration.md`, `docs/plantilla-integracion-juegos.md` y esta guía.
- Pruebas: `test/auth/auth0-auth-service.spec.ts` y `test/matchmaking/matches-page.spec.ts`.

Verificación local: lint y 47 pruebas unitarias aprobadas; build de producción aprobado con el aviso de tamaño del bundle compartido; 5 pruebas de navegador aprobadas en modo mock, incluyendo carga del demo en 4004. El build utiliza el modo mock por defecto porque no hay `.env` de producción; no valida un despliegue Auth0.

Se consultó la rama `feature/conexion` del Equipo 4, commit `de235042cc1f341da4a8286dc4541816cbe5086e`, y se confirmó el nombre del contenedor, módulo, puerto y extensión del contexto. Sigue pendiente la prueba de dos usuarios con Auth0, API/hub de Typing y callback M2M reales. No se realizaron commits, pushes ni modificaciones en los repositorios de los otros equipos durante esta tarea.
