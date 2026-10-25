# Integracion con Profile: pendientes para el equipo

Revision local: 25 de octubre de 2026. Se reviso `battlehub-profile-integration`; no se modifico su codigo. Los hallazgos incluyen cambios locales de esa carpeta y deben contrastarse con la rama que el equipo vaya a entregar.

## Objetivo

Cualquier cuenta de clase autorizada inicia sesion en Shell, obtiene su perfil local y puede ver y jugar lo que le permiten sus permisos. Sin registrar usuarios manualmente ni pedir otro login por juego.

## Lo que cambio Shell

- Sincroniza con POST /api/profiles/sync y consulta perfil, permisos y catalogo.
- Reutiliza una carga para consultas simultaneas y no acepta un perfil cuyo id sea distinto al usuario de la sesion.
- La cache dura como maximo un minuto antes de la siguiente lectura; no es un sondeo en segundo plano. Si la recarga falla, no se entregan datos antiguos desde el servicio.
- Perfil y catalogo tienen botones para actualizar explicitamente desde Profile, sin cerrar sesion.
- Salas usa el catalogo habilitado de Profile junto con los permisos, en vez de inventar una lista propia de juegos.
- Los permisos mostrados por Shell son presentacion; el backend sigue siendo responsable de autorizarlos en cada operacion. La cache no sustituye esa comprobacion ni garantiza revocacion inmediata en pantallas ya abiertas.

## Contrato que Shell consume

| Operacion | Respuesta esperada |
| --- | --- |
| POST /api/profiles/sync | 200 o 201 con JSON; cuerpo de entrada: displayName y email opcional |
| GET /api/profiles/me | id, displayName, email opcional, createdAt y lastLoginAt |
| GET /api/profiles/me/permissions | objeto con permissions como lista de codigos |
| GET /api/profiles/me/games | lista con gameType, name y requiredPermission |

Todos usan Authorization: Bearer con access token de usuario. El id del perfil debe corresponder al sub autenticado, nunca a un identificador elegido por el navegador. La audiencia y el emisor deben coincidir con el acuerdo de la plataforma; la referencia local es /profile, no una nueva URL donde alojar el servicio.

## Ajustes concretos del backend

1. En `Services/ProfileService.cs`, comprobar el alta idempotente de un usuario nuevo. Sync debe crear una sola cuenta y siguientes llamadas no deben restaurar permisos retirados o sanciones. Probar tambien llamadas simultaneas para el mismo sub.
2. En el alta actual se cargan TODOS los registros de Permissions y se asignan al nuevo perfil. Sustituirlo por una lista explicita de permisos basicos de jugador: matches.create y games.typing.play, games.trivia.play, games.memory.play, segun la politica acordada. No conceder permisos administrativos o de moderacion por existir en la tabla.
3. En `Data/ProfileDbContext.cs`, comprobar que el catalogo y los permisos basicos se crean mediante migraciones/datos iniciales reproducibles. Un catalogo deshabilitado o un permiso retirado no debe seguir apareciendo en /me/games.
4. En `Controllers/ProfilesController.cs`, mantener la identidad obtenida del token para todos los endpoints /me. Probar dos cuentas aisladas, ausencia de token y token invalido. No crear identidades de prueba en produccion.
5. En `Program.cs`, confirmar DatabaseProvider=MySQL y conexion por entorno para el despliegue. Actualmente cualquier valor distinto de MySQL cae al proveedor InMemory. Fuera de pruebas, fallar ante configuracion ausente o incorrecta en vez de perder los perfiles al reiniciar. Quitar la conexion de respaldo con usuario/contrasena root del codigo.
6. Verificar CORS para el origen local y el publicado de Shell, incluidos OPTIONS con Authorization. Configurar HTTPS de manera consistente para que una redireccion no rompa las llamadas del navegador.
7. Acordar con Matchmaking y juegos como se consultan los permisos en servidor. Los permisos guardados en MySQL no se convierten automaticamente en scopes del JWT. Si alguien no tiene acceso, responder con el estado apropiado sin obligar a repetir el consentimiento de Auth0.
8. Revisar la identidad de clientes M2M: no deben darse de alta como jugadores ni recibir sus permisos por el endpoint sync. Conservar separado el acceso de usuario y el de servicios.

## Pruebas necesarias

- Cuenta nueva: sync -> me -> permissions -> games, con los tres juegos basicos habilitados segun la politica acordada.
- Repetir sync no duplica usuarios ni recupera permisos retirados.
- Dos cuentas conservan perfiles distintos; un token no permite leer el perfil de otra.
- Permiso retirado o juego deshabilitado: deja de aparecer al actualizar Shell; las APIs tambien lo rechazan.
- Agregar un permiso administrativo a la tabla no se lo asigna a usuarios nuevos.
- Caida temporal: Shell muestra error y recupera al reintentar sin perder la sesion de Auth0.
- Reiniciar el backend conserva los perfiles en MySQL.
- Integracion contra MySQL efimero en CI, no solo EF InMemory. Las pruebas locales revisadas usan autenticacion simulada; agregar comprobaciones JWT de emisor, audiencia, firma y vencimiento.

## Mensaje para compartir

Hola, desde Shell ajustamos la actualizacion de perfil, permisos y catalogo. Salas ahora usa los juegos habilitados que devuelve Profile. Necesitamos confirmar el alta automatica e idempotente de cuentas de clase, los permisos basicos, persistencia MySQL y acceso desde el origen de Shell. Vimos que el alta asigna todos los permisos de la tabla: conviene limitarlo a los de jugador para no conceder moderacion o administracion por accidente. Cuando lo revisen, probamos juntos una cuenta nueva y otra con un permiso retirado.

## Commit sugerido para Shell

fix: actualizar perfil y juegos desde profile

No incluir los otros documentos de login ni cambios previos de configuracion en este commit sin revisarlos aparte.
