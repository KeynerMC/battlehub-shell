# Profile Service: integracion con Shell

Revision: 27 de octubre de 2026, `OAiza/battlehub-profile-service`, main `7038faf`. Se actualizo la carpeta habitual `battlehub-profile-integration`. No se hicieron cambios propios en su backend.

## Objetivo segun la aclaracion del profesor

Shell concentra el login, llama a Profile con el access token del usuario y muestra el acceso segun sus permisos. Los juegos se coordinan con Shell por eventos y no reciben la sesion. Profile no necesita emitir tokens para cada juego ni recibir sus eventos de inicio/finalizacion.

La API revisada devuelve perfil, permisos y catalogo como JSON. No emite un segundo JWT de permisos. Mantener ese contrato con Shell; si el profesor requiere expresamente otro token, acordarlo antes de cambiarlo. No se deduce esa necesidad de su comentario.

## Lo que ya resolvio Profile

- `Services/PlayerPermissions.cs`: lista explicita de permisos basicos (matches.create y jugar Typing, Trivia y Memory).
- `Services/ProfileService.cs`: deja de conceder todos los permisos existentes; sincronizar un perfil existente no restaura permisos retirados. Incluye recuperacion ante un alta concurrente del mismo usuario.
- `Controllers/ProfilesController.cs`: rechaza registrar clientes M2M como jugadores en /sync.
- `Program.cs`: valida el proveedor de datos y exige una conexion para MySQL; elimino la conexion de respaldo con credenciales root.
- Dockerfile, Compose con MySQL, volumen persistente y servicio de migraciones separado.
- Pruebas con MySQL mediante Testcontainers y pruebas de arranque/seguridad de alta. El CI incorpora construccion y prueba de arranque de Docker.

Estas implementaciones se comprobaron leyendo el codigo; no se ejecutaron las pruebas ni la plataforma real en esta revision. No pedir rehacer los puntos anteriores.

## Contrato que Shell utiliza y debe conservarse

Todas las llamadas usan `Authorization: Bearer <access token de usuario>` desde Shell.

| Operacion | Respuesta |
| --- | --- |
| POST /api/profiles/sync | 200 o 201 con JSON del perfil; entrada: displayName y email opcional |
| GET /api/profiles/me | id, displayName, email opcional, createdAt y lastLoginAt |
| GET /api/profiles/me/permissions | { "permissions": ["matches.create", "games.typing.play", "games.trivia.play", "games.memory.play"] } segun los permisos reales del usuario |
| GET /api/profiles/me/games | Lista con gameType, name y requiredPermission; solo juegos habilitados y permitidos |

El id proviene del sub del token validado, no de un identificador elegido por el cliente. Las fechas deben ser UTC. Respetar los codigos 401, 403 y 404 segun el caso; no responder con datos de otro usuario.

## Pendientes para trabajar con nosotros

### 1. Alinear configuracion real y comprobar el login

Responsables: Profile y Shell.

- Configurar `Auth0__Domain` y `Auth0__Audience` con el mismo emisor y audiencia que usa Shell. La referencia local actual es el tenant compartido y `https://api.battlehub.local/profile`; confirmar los valores efectivos antes de desplegar.
- `appsettings.json` mantiene placeholders (`auth.battlehub.local` y `https://api.battlehub.com`): no sirven automaticamente para el tenant de clase. Sobrescribir por entorno.
- Configurar `Cors__Origins__0` para el origen real de Shell (local: http://localhost:4000; publicado: la URL HTTPS que acordemos). Probar OPTIONS con Authorization y peticiones posteriores.
- El jugador no configura secretos, tokens ni bases de datos. El responsable del backend configura MySQL y el despliegue una sola vez.
- No borrar registros de Auth0 ni quitar [Authorize] de los endpoints.

### 2. Probar altas, permisos y catalogo con cuentas reales

Responsables: Profile y Shell.

- Una cuenta nueva de clase debe completar sync -> me -> permissions -> games sin registrarla manualmente.
- Debe ver los tres juegos basicos segun la politica acordada, sin permisos administrativos o de moderacion.
- Retirar un permiso y volver a sincronizar no debe devolverlo. Deshabilitar un juego debe retirarlo del catalogo.
- Probar dos cuentas distintas, solicitudes simultaneas para el mismo sub y persistencia al reiniciar con MySQL.
- Revisar el caso de un catalogo de permisos parcialmente cargado: el alta agrega permisos faltantes solo si NO encuentra ninguno de los basicos. Si existe uno pero faltan otros tres, el usuario recibe solo el existente. Definir si se garantiza el conjunto completo mediante migracion/seed o se completa explicitamente, sin otorgar permisos extra. Agregar una prueba para ese caso.

### 3. Endurecer la configuracion de despliegue

Responsable: Profile.

`Program.cs` ya rechaza valores desconocidos o proveedor ausente fuera de Development, pero todavia permite `DatabaseProvider=InMemory` de forma explicita en cualquier entorno. Para garantizar persistencia en el despliegue de clase, usar MySQL y considerar restringir InMemory a Development/Testing; agregar la prueba de arranque correspondiente si se aplica esa politica.

Compose ya fija MySQL. Verificar migraciones y volumen en el ambiente publicado. No recrear ni eliminar volumenes para probar sobre datos que deban conservarse.

### 4. Completar la comprobacion de JWT y las pruebas conjuntas

Responsables: Profile y Shell.

Las pruebas de endpoints revisadas usan un AuthenticationHandler de prueba. Eso permite probar negocio, pero no demuestra que un token real de Shell sea aceptado. Mantenerlas y agregar/comprobar pruebas del JwtBearer real con firma valida e invalida, emisor, audiencia y vencimiento. Puede usarse una clave de pruebas y discovery simulado; no requieren secretos reales en CI.

Las pruebas MySQL pueden saltarse localmente si Docker no esta disponible. Al reportar resultados, distinguir ejecutadas y omitidas; comprobar que las MySQL efectivamente se ejecutan en CI.

## Que no corresponde agregar a Profile por este cambio

- Otro login dentro de los juegos o un token por juego.
- Secretos M2M enviados al navegador.
- Finalizar partidas basandose en un evento de navegador: corresponde acordarlo entre Shell, Matchmaking y los juegos, con validacion en servidor.
- Un emisor JWT nuevo sin un contrato acordado. El flujo actual Shell -> Profile ya usa el token del login.

Los permisos que muestra Shell no reemplazan la autorizacion del servidor. La proteccion de APIs/hubs de los juegos y la nueva finalizacion siguen siendo acuerdos pendientes del flujo por eventos; no se resuelven solo con /me/permissions.

## Lista para cerrar la integracion

- [ ] Profile y MySQL levantan con el procedimiento documentado.
- [ ] El token real de Shell se acepta; tokens invalidos se rechazan.
- [ ] Cuenta nueva obtiene perfil y juegos sin configuracion tecnica personal.
- [ ] Dos cuentas conservan identidades separadas.
- [ ] Permiso retirado y juego deshabilitado se reflejan al actualizar Shell.
- [ ] Repetir sync no duplica perfiles ni restaura permisos.
- [ ] Los datos sobreviven a un reinicio del servicio.
- [ ] CORS y HTTPS funcionan desde el origen publicado de Shell.

Shell permite actualizar perfil/catalogo manualmente y renueva la cache al consultar despues de un minuto. No promete revocacion instantanea en una vista abierta; las APIs deben aplicar los permisos que correspondan en cada operacion.

## Mensaje para enviar al equipo

Hola, ya actualizamos Profile al main 7038faf y vimos que resolvieron los permisos basicos, alta segura, bloqueo de M2M en sync y Docker con MySQL. Segun la aclaracion del profe, Shell mantiene el login y consulta a Profile; los juegos van por eventos sin recibir la sesion. Por ahora necesitamos confirmar dominio, audience y CORS de Profile con Shell, mantener los cuatro endpoints actuales y probar una cuenta nueva y otra con permiso retirado. No hace falta crear tokens por juego. Quedan por revisar el caso de permisos basicos parcialmente cargados, la restriccion de InMemory en despliegue y pruebas de JWT real, ademas de la prueba conjunta.

## Respaldo local

Antes de actualizar se guardaron los ajustes anteriores en el stash `2d56f4f5152b613f8832725dcbc6c12cb6cbbc78`, mensaje `respaldo-profile-antes-actualizar-20261027`. No se reaplico; la carpeta coincide con origin/main. Revisar diferencias antes de recuperar ese respaldo.
