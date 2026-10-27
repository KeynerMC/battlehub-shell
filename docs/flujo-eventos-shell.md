# Flujo de Shell y juegos por eventos

Actualizado el 27 de octubre de 2026 a partir de las respuestas del profesor del 26 de octubre. Sustituye la propuesta anterior de entregar el access token del Shell a los juegos.

## Responsabilidades

1. El jugador inicia sesion en Shell. El token permanece en los servicios internos de autenticacion y clientes de API de Shell.
2. Shell sincroniza el usuario con Profile y consulta sus permisos y catalogo. La API actual devuelve permisos como JSON: no se inventa un segundo token de Profile.
3. Shell consulta las salas en Matchmaking y comprueba permisos y participacion antes de cargar el juego.
4. Shell pasa al modulo un GameContext con matchId, gameType, currentUser y events (un EventTarget creado para esa instancia). No entrega getAccessToken ni getMatchmakingAccessToken.
5. GameHost inicializa y monta el modulo. Publica battlehub:game-start; el adaptador del host ejecuta GameModule.start una sola vez como respuesta a esa orden. Al terminar start publica battlehub:game-started.
6. Al finalizar y guardar sus resultados, el juego publica battlehub:game-finished en ese mismo canal. Shell recibe el evento y notifica a Matchmaking.
7. Solo cuando Matchmaking confirma el estado Finished, Shell muestra la partida como finalizada. Un error deja la notificacion pendiente y permite reintentar.

Los nombres de evento, su canal y su payload son una propuesta implementada localmente para coordinar con los equipos. El profesor indico el flujo general; no fijo esos nombres ni aprobo un endpoint nuevo. Deben formalizarse en el contrato/ADR correspondiente.

## Ejemplo para los juegos

```typescript
// initialize guarda el contexto y prepara el juego sin otro login.
async initialize(context: GameContext): Promise<void> {
  this.context = context;
}

// El host invoca start al recibir la orden de inicio.
// No implementar otro inicio paralelo al escuchar game-start.
async start(): Promise<void> {
  // Arrancar o reanudar usando la integracion de backend que se acuerde.
}

// Solo despues de que el backend haya confirmado el resultado guardado:
this.context.events?.dispatchEvent(new CustomEvent('battlehub:game-finished', {
  detail: { matchId: this.context.matchId, gameType: this.context.gameType },
}));
```

El evento no transporta token, ganador ni puntajes. El backend del juego sigue siendo responsable de sus resultados. El canal es local al mismo navegador y no reemplaza SignalR entre jugadores.

## Notificacion a Matchmaking

El adaptador de Shell envia POST /api/matches/{id}/finish con el token de USUARIO de Shell y sin body. No contiene ClientSecret ni intenta obtener un token M2M. Antes y despues consulta el estado de la sala, comprueba tipo y participacion y exige confirmacion Finished. Acepta 204 del POST y luego consulta GET.

BLOQUEO DE INTEGRACION: el endpoint de los repositorios revisados esta reservado a servicios M2M segun ADR-004. Por tanto, puede rechazar la llamada de Shell con 403. El equipo de Matchmaking debe acordar y proporcionar una operacion autorizada para notificaciones de Shell, o el intermediario de servidor que se decida. Si cambia la ruta, se ajusta notifyFinished en remote-matchmaking-service.ts.

No basta permitir cualquier token de usuario: el servidor debe verificar identidad, acceso a la partida y que exista un resultado final autoritativo del juego. Debe resolver atomicidad, idempotencia, finalizacion duplicada por los dos participantes y rechazos. Un evento del navegador puede fabricarse y no demuestra que una partida termino.

No se eliminan las restricciones del servidor actual. Hasta ese acuerdo la notificacion puede quedar pendiente; no se finge exito ni se introducen secretos en Shell.

## Ajustes pendientes fuera de Shell

- Juegos: consumir contexto sin proveedores de tokens y emitir el evento de fin. Sus versiones actuales aun esperan tokens; algunas fallaran o entraran en modo de desarrollo/previsualizacion al faltar estos proveedores. No son compatibles automaticamente con este cambio.
- Juegos y profesor: definir como se protegen sus APIs y hubs sin recibir el token de sesion. No abrir endpoints ni confiar en currentUser del navegador. No se eligio ni implemento un reemplazo de seguridad en los juegos.
- Juegos: cuando se active el flujo nuevo, evitar que el backend y Shell envien dos notificaciones independientes de finalizacion. Mantener resultados persistidos y reintentos segun el acuerdo.
- Matchmaking: resolver la autorizacion y verificacion del fin para el flujo de Shell.
- Profile: mantener el contrato de perfil y permisos que ya consume Shell. Ningun cambio de emision de tokens se asume aqui.

## Verificacion

Las pruebas de Shell cubren contexto sin tokens para los tres juegos, denegacion de permiso, inicio por evento una sola vez, eventos de otra partida ignorados, notificaciones duplicadas, confirmacion por servidor, rechazo del POST y reintento. Se conservan las pruebas de limpieza, navegacion y cambio de sesion.

La prueba real con los seis servicios sigue pendiente de los ajustes anteriores. No publicar este cambio como plataforma completamente funcional antes de esa verificacion.

Commit sugerido: refactor: coordinar los juegos por eventos desde el shell
