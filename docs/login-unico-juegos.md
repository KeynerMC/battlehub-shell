# Login unico para los juegos

El Shell solicita el token de AUTH0_AUDIENCE para Profile, Matchmaking y los juegos. Ya no solicita tokens con AUTH0_TYPING_AUDIENCE, AUTH0_TRIVIA_AUDIENCE ni AUTH0_MEMORY_AUDIENCE, ni abre ventanas de consentimiento por juego. Estas variables antiguas todavia se leen por compatibilidad de configuracion, pero no se usan para obtener tokens.

Se conserva la renovacion silenciosa del SDK, la comprobacion de identidad y los permisos de Profile. Tener una sesion no elimina restricciones de permisos, sanciones o pertenencia a la partida.

## Coordinacion antes de publicar

Este cambio del Shell NO es compatible por si solo con las APIs actuales que exigen una audiencia distinta por juego. Debe coordinarse el contrato de autenticacion y su ADR con los equipos de backend antes de desplegarlo.

- Typing configura la audiencia de usuario en Auth:Audience.
- Trivia configura la audiencia en Auth:Audience y tambien valida emisor y firma.
- Memory configura su propia audiencia en Auth:Audience.
- Los tres deben aceptar la audiencia acordada para la plataforma, validar emisor, firma y vencimiento, y mantener sus reglas de autorizacion. Cambiar solo Shell produce respuestas 401 si siguen esperando las audiencias anteriores.
- No cambiar clientes M2M ni el permiso matches.finish como parte de este paso. Son comunicacion entre servicios.
- No borrar registros de Auth0 durante esta migracion.

## Comprobacion manual pendiente

Con los servicios configurados para el contrato acordado: iniciar sesion una vez, abrir una partida de cada juego y comprobar que las llamadas HTTP y SignalR funcionan sin otro Authorize. Probar tambien sesion vencida, cierre de sesion y usuario sin permisos.

Las pruebas unitarias usan un SDK simulado; no sustituyen esta comprobacion con Auth0 y los backend reales.

## Commit sugerido

fix: usar la sesion del shell para entrar a los juegos

Archivos de este cambio: src/auth/auth-service.ts, src/auth/auth0-auth-service.ts, src/pages/matches/matches-page.ts, src/pages/matches/matches-page.html, test/auth/auth0-auth-service.spec.ts, test/matchmaking/matches-page.spec.ts y este documento. No incluir los otros cambios locales pendientes.
