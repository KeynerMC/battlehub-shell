# Login e integracion de juegos

La respuesta del profesor del 26 de octubre aclara que Shell maneja el login y los permisos; los juegos reciben el inicio y notifican su fin por eventos, sin recibir la sesion.

La propuesta anterior de audiencia compartida para entregar tokens a los juegos queda sustituida por [el flujo por eventos](flujo-eventos-shell.md). No borrar registros de Auth0 ni quitar la autenticacion de los backend para hacer esta migracion.

Indicaciones por equipo:

- [Typing](login-unico-typing.md)
- [Trivia](login-unico-trivia.md)
- [Memory](login-unico-memory.md)

Shell mantiene el token para sus propias llamadas a Profile y Matchmaking. La proteccion de las APIs de los juegos y la autorizacion de la finalizacion deben acordarse antes del despliegue completo.
