# Matchmaking

## Configuración

Agregar a `.env.development` y reiniciar el Shell:

```dotenv
BATTLEHUB_AUTH_MODE=auth0
MATCHMAKING_SERVICE_URL=http://localhost:5211
```

Mantener las variables de Auth0 y Profile indicadas en [la guía de autenticación](auth0-profile-integration.md).

| Servicio | Dirección local |
|---|---|
| Shell | `http://localhost:4000` |
| Profile | `http://localhost:5220` |
| Matchmaking | `http://localhost:5211` |
| Lobby Hub | `http://localhost:5211/hubs/lobby` |

Matchmaking requiere MongoDB y Profile Service en ejecución. Su política CORS debe permitir el origen del Shell.

## Autenticación

El Shell utiliza el token de `AUTH0_AUDIENCE`. La implementación actual requiere que Profile y Matchmaking acepten la misma audiencia lógica, porque Matchmaking reenvía ese token para consultar perfil y permisos.

Esta configuración debe acordarse con el Equipo 1 y el Tech Lead. Los contratos no fijan una audiencia compartida. Usar audiencias independientes requiere adaptar la delegación de acceso a Profile; no basta con modificar la URL del servicio.

## Salas

La ruta `/matches` permite crear, consultar, unirse, salir, iniciar y cancelar salas. Las opciones de juego se obtienen de los permisos del usuario. El backend valida cada acción; crear una sala requiere `matches.create` y el permiso del juego.

SignalR notifica los cambios. El Shell recupera el estado mediante REST, renueva la presencia cada 20 segundos y vuelve a suscribirse tras una reconexión. Al salir de la página se cierra la conexión y se detiene el heartbeat.

Cuando una partida comienza, el Shell entrega `matchId`, `gameType` y `currentUser` a GameHost. Si el juego no está registrado en `config/remotes.local.json`, muestra un aviso de disponibilidad.

Typing está registrado en la configuración local y recibe además un proveedor opcional `getAccessToken`, como extensión local del contexto. Su token usa una audiencia independiente de Profile y Matchmaking. Consulta [la guía de Typing](typing-integration.md). Cuando la sala pasa a Finished, el Shell consulta su detalle y conserva el juego hasta que el usuario lo cierre, para permitir resultados e historial; una sala cancelada o eliminada cierra el juego.

`/lobby` y `/play` corresponden a la demostración en modo mock.

## Límites actuales

- Cerrar el juego no finaliza la partida.
- Nuestra copia local de Matchmaking implementa `/finish` para servicios M2M; falta confirmar su publicación por el Equipo 2. ADR-004 sigue siendo una propuesta y el Shell no llama ese endpoint.
- Los juegos requieren sus propios remotes, APIs y hubs.
- La sesión única entre pestañas está pendiente.
- El backend requiere un mecanismo de distribución de eventos para desplegar varias instancias de SignalR.

## Prueba de integración

1. Iniciar MongoDB, Profile, Matchmaking y Shell.
2. Entrar con dos usuarios distintos en navegadores separados.
3. Crear una sala y unirse desde el segundo usuario.
4. Verificar los participantes en ambas ventanas.
5. Iniciar como anfitrión y comprobar la carga del juego o el aviso de remote no disponible.
6. En otra sala, comprobar salida, cancelación y reconexión.

Las pruebas unitarias se ejecutan con `npm test -- --runInBand --coverage=false`; la compilación, con `npm run build`.
