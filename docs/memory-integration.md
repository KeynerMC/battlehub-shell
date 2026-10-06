# Memory: preparación local del Shell e instrucciones para Equipo 6

Revisión del 2026-10-04. Repositorio `paulapgarciazzz/battlehub-game-memory`, rama por defecto `main`, commit `c2ac89123d5d743456024f2058420c717d0172da`. Clonado por separado en `../battlehub-memory-integration`. La rama `fix/backend-arreglos` no tiene commits adicionales respecto de main. No se modificó ni publicó el código del Equipo 6.

## Nuestra parte: Shell

- Remote `memoryGame`, URL `http://localhost:4003/remoteEntry.js`, exportación `./GameModule`. Confirmados en el Webpack de su repo.
- Configuración `AUTH0_MEMORY_AUDIENCE`; valor preparado en `.env.development`: `https://api.battlehub.local/memory`. `.env.example` mantiene el campo vacío para configurar el entorno propio.
- Tokens de jugadores Memory separados de Typing, Trivia y Profile/Matchmaking.
- Botón **Autorizar Memory** cuando haga falta consentimiento. Popup solo por acción del usuario y con la misma identidad de la sesión.
- Contexto con `getAccessToken()` para API/hub Memory y `getMatchmakingAccessToken()` para consultar la sala en Matchmaking desde el backend Memory. Las funciones se rechazan al cerrar el juego o cambiar sesión; no se almacenan JWT como campos del contexto.
- Creación de salas Memory con dos plazas y validación de exactamente dos participantes al abrir y al revalidar la sala. Es una restricción de compatibilidad con el servicio actual del Equipo 6, que crea la sesión cuando llegan los dos primeros jugadores. El backend del juego también debe validarla.
- Se conserva el resultado al cambiar Matchmaking a Finished, como en los otros juegos. No se agregó URL de producción sin un despliegue real.

Los proveedores de tokens son extensiones locales **propuestas** del contrato GameContext. No se presentan como decisión aprobada del profesor. ADR-007 sigue Propuesto y contempla Profile/Matchmaking, no la audiencia de jugadores de Memory.

## Lo que encontramos en Memory

Su repo ya incluye frontend Aurelia 2.0.0-rc.2, Module Federation compatible, tablero de 16 cartas, previsualización de cinco segundos, turnos de diez segundos, lógica del servidor, resultados idempotentes y persistencia SQL Server. Se deben conservar sus reglas y motor.

Todavía faltan en la versión revisada:

- JWT y políticas de autorización en API/hub.
- Identidad desde `sub`; actualmente JoinMatch y FlipCard reciben el userId del navegador.
- Validación de sala, estado y participantes contra Matchmaking.
- Uso de los proveedores del Shell en SignalR y REST.
- Reingreso al grupo y snapshot después de una reconexión; actualmente se configura reconnect pero no se recupera la partida.
- Callback M2M a Matchmaking y recuperación persistente de avisos pendientes.
- Confirmación explícita del guardado antes de presentar el resultado como guardado: hoy CardFlipped se emite antes de intentar guardar, y el frontend también vuelve a llamar POST results.
- Liberación/reutilización correcta de suscripciones: el orquestador singleton se suscribe en su constructor, pero leaveMatch solo desconecta y limpia estado.

Registrar el remote en Shell no corrige estos puntos. El juego actual no utiliza las nuevas funciones del contexto: puede mostrar el tablero, pero no se considera integrada la autenticación ni la finalización entre equipos.

## Auth0: configuración que necesitamos

Tenant: `dev-jaii1peslxnejq0y.us.auth0.com`.

| Recurso | Configuración |
| --- | --- |
| API de jugadores | Name: `BattleHub Memory API` |
| Identifier / audiencia | `https://api.battlehub.local/memory` |
| Algoritmo | `RS256` |
| Acceso delegado | Autorizar la SPA `BattleHub Shell` |
| Aplicación de backend | `BattleHub Memory Service`, tipo Machine to Machine |
| API autorizada del M2M | BattleHub Profile Service, Identifier `https://api.battlehub.local/profile` |
| Permiso del M2M | Solamente `matches.finish` |

La aplicación M2M es diferente de la API de jugadores y de la aplicación de prueba que Auth0 pueda crear. Su Client ID se comparte con Equipo 2; su Client Secret solo se configura de forma privada en el backend Memory. No se guarda en el Shell, frontend, ZIP, Git ni documentos.

No se confirmó todavía que estos recursos de Memory existan en el tenant. Establecer la variable del Shell no los crea. No hace falta asignar `matches.finish` a usuarios ni a la SPA Shell.

## Archivos del Equipo 6 y cambios necesarios

Las rutas siguientes son relativas a la raíz de su repo.

| Archivo | Cambio |
| --- | --- |
| `src/BattleHub.Memory.Api/BattleHub.Memory.Api.csproj` | Añadir JWT Bearer compatible con .NET 10. |
| `src/BattleHub.Memory.Api/Program.cs` | Registrar JWT, políticas, autenticación/autorización y protección de hub/controladores. Mantener CORS 4000/4003; coordinar HTTP local sin redirecciones incompatibles y HTTPS en despliegue. |
| `src/BattleHub.Memory.Api/appsettings.json` | Añadir Domain y audiencia Memory, URL de Matchmaking y audiencia de callback. Client Secret fuera del repo. Conservar SQL Server/MemoryDatabase. |
| `src/BattleHub.Memory.Api/Hubs/MemoryHub.cs` | Autorizar, obtener jugador de sub, consultar sala Started/memory y dos participantes, vincular conexión a sala e impedir jugar fuera de ella. No confiar en userId/displayName enviados por navegador. Recuperar snapshot tras reingreso. |
| `src/BattleHub.Memory.Api/Services/MemoryGameService.cs` | Conservar motor, usar el roster validado de Matchmaking, impedir terceros y mantener el estado al reconectar. |
| `src/BattleHub.Memory.Api/Services/TurnTimerService.cs` | Conservar diez segundos y número de turno; devolver vencimiento UTC para recuperación y cancelar recursos cuando corresponda. |
| `src/BattleHub.Memory.Api/Services/MatchResultRecorder.cs` | Guardar primero, registrar aviso pendiente duradero y emitir confirmación de resultado después del guardado. |
| `src/BattleHub.Memory.Data/Services/GameResultService.cs` | Conservar idempotencia y guardar resultado + aviso en una transacción; reforzar unicidad en base si falta. |
| `src/BattleHub.Memory.Data/DbContext/MemoryDbContext.cs` | Registrar entidad de cola de avisos si se adopta la misma estrategia de Trivia. |
| `src/BattleHub.Memory.Data/Migrations/` | Nueva migración aditiva para la cola y ajustes acordados; no reescribir migraciones existentes. |
| `src/BattleHub.Memory.Api/Controllers/MemoryController.cs` | Proteger historial/estadísticas y permitir solo el sub propietario. |
| `src/BattleHub.Memory.Api/Controllers/MemoryGameResultsController.cs` | Proteger resultado por participantes. El navegador no debe determinar ni forzar el guardado; eliminar la dependencia del POST de reintento o acordar un endpoint restringido que solo reintente una sesión terminada válida. |
| `src/memory-microfrontend/memory-game/src/game-contracts.ts` | Añadir proveedores opcionales getAccessToken/getMatchmakingAccessToken como extensión local acordada. |
| `src/memory-microfrontend/memory-game/src/game-module.ts` | Validar gameType memory y proveedores, configurarlos en initialize, conectar en start y limpiar en dispose. |
| `src/memory-microfrontend/memory-game/src/services/memory-hub.service.ts` | Usar accessTokenFactory; eliminar userId/displayName como identidad autorizada; reingresar tras reconnect y obtener snapshot. |
| `src/memory-microfrontend/memory-game/src/services/memory-http.service.ts` | Authorization Bearer de Memory en REST; retirar guardado desde frontend del flujo normal. |
| `src/memory-microfrontend/memory-game/src/services/memory-game-orchestrator.ts` | Pasar proveedores a servicios, recuperar fases/tablero/turno, gestionar suscripciones sin duplicarlas y esperar confirmación de persistencia. |
| `src/memory-microfrontend/memory-game/src/models/memory-hub.messages.ts` | Tipar snapshot, vencimientos UTC y confirmación de guardado, sin filtrar información que no corresponda a la fase. |
| `src/memory-microfrontend/memory-game/config/environment.json` | Conservar API/hub local 5095; valores de producción reales en environment.production.json cuando desplieguen. |
| `tests/BattleHub.Memory.UnitTests/` y `src/memory-microfrontend/memory-game/test/` | Mantener pruebas del motor y ampliar identidad, turnos, contexto, reconexión y lifecycle. Añadir pruebas de integración reales de API/hub/persistencia. |

Agregar servicios separados para la consulta de Matchmaking y el cliente M2M/cola; no mezclar las credenciales M2M con el hub de jugadores.

Propuesta de llamadas del hub a coordinar con el equipo, no contrato central aprobado:

```typescript
JoinMatch(matchId, matchmakingAccessToken)
FlipCard(matchId, cardId)
```

El token de Memory autentica la conexión; el segundo token se usa solo para GET del detalle de Matchmaking. El backend identifica al jugador por sub y obtiene su nombre del participante del roster. No recibe userId del navegador como fuente de autorización.

## Equipo 2 y Equipo 1

Equipo 2: mantener GET `/api/matches/{id}` con participantes y POST `/api/matches/{id}/finish` idempotente. Agregar `CLIENT_ID_MEMORY_SERVICE: memory` en `GameServices:Clients`, conservando los demás juegos. No hay ID real de Memory disponible todavía. En el backend del juego validar dos participantes; coordinar también impedir capacidad mayor de dos para Memory en Matchmaking, porque otros clientes podrían crear salas sin pasar por este Shell.

Equipo 1: los seeds de nuestra copia ya incluyen memory habilitado, games.memory.play y permisos iniciales. Comprobar la base y versión reales: ambos jugadores con games.memory.play y anfitrión con matches.create. No se asume que los cambios locales estén publicados.

## Orden de trabajo y prueba

1. Completar JWT y proveedores del frontend; validar sala y pertenencia en backend.
2. Conservar mecánica existente y añadir recuperación tras reconexión.
3. Completar guardado confirmado y callback M2M duradero.
4. Configurar SQL y aplicar migraciones aditivas; no usar MySQL para esta copia.
5. Levantar Profile, Matchmaking, Memory API 5095, remote 4003 y Shell 4000.
6. Crear sala memory con dos cuentas, unirse, iniciar y autorizar Memory con la misma cuenta de Shell si se solicita.
7. Completar ocho parejas; comprobar turnos, timeout, empate, historial, resultado persistido y sala Finished.
8. Probar reconexión, usuario ajeno, suplantación de jugador, token de otra audiencia y llamadas anónimas.

Verificación de nuestra parte: lint, 58 pruebas del Shell y build de producción. Se verificaron audiencias separadas, consentimiento, contexto y revocación de proveedores, dos plazas y revalidación de participantes. El build conserva el aviso previo de tamaño del bundle. No se probó una partida Memory autenticada real: su backend/frontend todavía tienen los pendientes descritos.

## Archivos cambiados en Shell para Memory

`config/remotes.local.json`, `.env.example`, `.env.development` (ignorado), `src/infrastructure/configuration.ts`, `src/auth/auth0-auth-service.ts`, `src/pages/matches/matches-page.ts`, `src/pages/matches/matches-page.html`, pruebas de auth/configuración/salas, README y documentación de integración. Se preservaron los cambios anteriores de Typing/Trivia. La configuración privada de `.env.development` queda fuera del repositorio.
