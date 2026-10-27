# Integracion de Trivia con Shell por eventos

Actualizado el 27 de octubre de 2026. Estas indicaciones sustituyen la propuesta anterior de pasar tokens del Shell a los juegos, a partir de la aclaracion del profesor.

## Cambios a coordinar

1. Revisar src/trivia-frontend/src/game-module.ts y src/trivia-frontend/src/contracts/game-contracts.ts. El contexto integrado ya no tiene getAccessToken ni getMatchmakingAccessToken. Tiene matchId, gameType, currentUser y events.
2. Mantener initialize/start/pause/dispose. Shell publica battlehub:game-start y su adaptador llama a start. No iniciar dos veces la partida escuchando el evento y ejecutando start en paralelo.
3. Mantener la logica de juego y guardar los resultados en su backend. No calcular ni confiar el resultado al Shell.
4. Despues de guardar el resultado confirmado, emitir en context.events el evento battlehub:game-finished con detail: { matchId, gameType }. Shell se encarga de avisar a Matchmaking y comprobar su confirmacion.
5. Retirar del modo integrado la exigencia de otra sesion, consentimiento o tokens de usuario recibidos desde Shell. No activar un fallback de desarrollo o practica para aparentar una partida integrada valida.
6. Acordar con el profesor y los otros equipos como se autentican las APIs y hubs en el nuevo flujo. No quitar Authorize ni confiar en currentUser recibido del navegador. La solucion de seguridad de backend aun no esta definida.
7. Coordinar el retiro del aviso directo juego -> Matchmaking cuando este listo el nuevo mecanismo. No romper el flujo existente antes de tener el reemplazo acordado y probado.
8. En dispose, cerrar SignalR, temporizadores y listeners. Un evento del contexto anterior deja de ser atendido por Shell tras cerrar la vista o cambiar sesion.

## Evento de fin propuesto

```typescript
context.events?.dispatchEvent(new CustomEvent('battlehub:game-finished', {
  detail: { matchId: context.matchId, gameType: context.gameType },
}));
```

Estos nombres y payloads deben acordarse con todos los equipos y documentarse. El evento no incluye tokens ni secretos y no acredita por si solo que el resultado exista. Matchmaking debe verificarlo en servidor.

## Prueba conjunta pendiente

- Iniciar sesion solo en Shell y cargar Trivia sin otro Authorize.
- Jugar con dos cuentas de clase y comprobar que el resultado queda guardado.
- Recibir el evento de fin en Shell y confirmar Finished desde Matchmaking.
- Probar reconexion, falta de acceso, eventos duplicados y salida durante una carga.

Las versiones actuales de los juegos aun esperan proveedores de tokens. Este cambio de Shell no las vuelve compatibles automaticamente. La ruta de finalizacion actual de Matchmaking exige M2M: hay que adaptar esa integracion sin exponer secretos en el navegador.

Ver [contrato propuesto y dependencias](flujo-eventos-shell.md).
