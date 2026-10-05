# Integración local de Trivia

Actualización 2026-10-04 sobre el remote de `DiegoGutz316/battlehub-game-trivia`, main `c791635`. Los cambios de esta integración siguen locales; no se publicaron ni se aprobó una modificación del contrato del profesor.

El Shell registra `triviaGame` en `http://localhost:4002/remoteEntry.js`, módulo `./GameModule`. Abre únicamente salas Started donde el usuario es participante, revalida el detalle y conserva la pantalla final cuando la sala cambia a Finished.

El contexto entrega `matchId`, `gameType: trivia`, `currentUser.id` igual al sub, `displayName` y dos funciones:

- `getAccessToken()`: audiencia `https://api.battlehub.local/trivia` para API/hub de jugadores.
- `getMatchmakingAccessToken()`: audiencia Profile/Matchmaking para que el backend de Trivia valide la sala. El Shell también lo ofrece a Memory en su integración correspondiente.

Ambas funciones dejan de funcionar al cerrar el juego, abandonar la página o cambiar de sesión. Los tokens no se guardan como datos serializados del contexto. Son **extensiones locales propuestas**, no modificaciones aprobadas del contrato central. La audiencia compartida Profile/Matchmaking continúa siendo una propuesta de ADR-007.

El usuario confirmó la API de Trivia con RS256 y acceso delegado para BattleHub Shell mediante captura de Auth0. No se verificó administrativamente el tenant. En `.env.development`, mantener `AUTH0_TRIVIA_AUDIENCE=https://api.battlehub.local/trivia` y reiniciar el Shell tras cambios. La autorización adicional se solicita mediante el botón Autorizar Trivia y debe usar la misma cuenta.

La copia local de Trivia ahora implementa JWT, cliente SignalR, preguntas, tiempos, revisión, marcador, reconexión, resultado, historial y cola persistente de finalización M2M. Su guía completa está en `../battlehub-trivia-integration/docs/integracion-shell-auth0.md`; la entrega del Equipo 5 incluye código y comandos sin credenciales privadas.

Pendiente antes de la prueba real entre equipos:

1. Confirmar/crear la aplicación M2M BattleHub Trivia Service, autorizar `matches.finish` en la API Profile/Matchmaking y configurar su secreto solamente en el backend Trivia.
2. Agregar su Client ID al mapa `GameServices:Clients` del Equipo 2 con valor `trivia`, conservando Typing.
3. Verificar en el Profile real `trivia` habilitado y `games.trivia.play` para ambos usuarios, `matches.create` para el anfitrión. Los seeds locales ya incluyen esos registros; no asegura que estén en una base desplegada.
4. Levantar Profile, Matchmaking, API Trivia 5185, remote 4002 y Shell 4000. Crear/unirse/iniciar sala con dos cuentas y completar las diez preguntas; comprobar historial y transición a Finished.

Verificación local: lint, 52 pruebas del Shell y build aprobados. La prueba de Trivia usa dos clientes SignalR reales, JWT temporales y SQL Server LocalDB; Matchmaking está sustituido por un servicio controlado. No se afirma todavía una prueba manual completa con Auth0 real ni un despliegue. Se conserva el aviso previo de tamaño del bundle del Shell.

No se inventaron URLs de producción: quedan pendientes el despliegue del equipo, HTTPS, CORS y el registro del remote real en `remotes.production.json`.
