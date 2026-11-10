# Shell y audiencia compartida — issue 13


> **Documento historico conservado el 10 de noviembre de 2026.** Describe una revision anterior, no el contrato vigente ni evidencia de pruebas actuales. Para integrar usar el README y los tipos de `src/games`: los juegos reciben contexto y eventos sin proveedores de tokens; Shell notifica el fin a Matchmaking. Las referencias antiguas a Node 24, tokens por juego, permisos en Matchmaking o callbacks M2M de los juegos quedan superadas por el contrato de Etapa 2.

Rama de pruebas: feat/pruebas-shell-issue13. El contrato central y ADR-007 requieren revisión del Tech Lead; esta implementación no equivale a aprobación.

El Shell usa su aplicación SPA y solicita un access token con audience `https://api.battlehub.local/profile`. Envía ese token como Bearer a Profile y Matchmaking. No utiliza el ID token como autorización de API ni contiene Client Secrets M2M.

Después del login sincroniza `/api/profiles/sync`, consulta `/api/profiles/me`, verifica que el perfil corresponda al usuario autenticado y consulta `/api/profiles/me/permissions` y `/api/profiles/me/games`. Los permisos controlan la interfaz; Matchmaking debe volver a comprobarlos en el servidor para cada acción según el acuerdo del issue 13.

Las peticiones REST a Profile y Matchmaking ya usan `redirect: 'error'`, timeout y validación de sesión antes y después de obtener tokens/respuestas. Un error de Profile no debe habilitar permisos de respaldo. Los tokens se obtienen mediante el SDK de Auth0; no se escriben en documentación, archivos versionados ni logs.

## Transporte y pruebas locales

Webpack fija NODE_ENV según su modo de compilación. `npm start` permite URLs HTTP exclusivamente de loopback (localhost, 127.0.0.1 o ::1); no permite enviar el token a HTTP de una máquina remota. `npm run build` exige HTTPS para Profile y Matchmaking cuando se configura modo auth0. El Shell con Auth0 también debe abrirse por HTTPS fuera de desarrollo.

La configuración local `.env.development` sigue usando Profile `http://localhost:5220` y Matchmaking `http://localhost:5211`. No agregar NODE_ENV a los archivos dotenv: lo determina Webpack. No hay que cambiar el tenant ni registrar otra SPA para probar estos cambios.

En despliegue configurar `.env` o variables de compilación con URLs HTTPS, publicar Shell por HTTPS y configurar callbacks/orígenes de Auth0 y CORS. El hub deriva su URL de Matchmaking y debe ofrecer HTTPS/WSS; TLS/certificados se configuran en el servidor o proxy. La comprobación del Shell no instala certificados.

Las audiencias de jugadores de Typing, Trivia y Memory permanecen separadas de la compartida Profile/Matchmaking. El endpoint finish corresponde a clientes M2M de los backends de juegos con matches.finish; el Shell no lo invoca como un servicio M2M.

## Responsabilidades y verificación

- Equipo 1: API Auth0/audience compartida, perfil y permisos coherentes, clientes M2M para finish.
- Equipo 2: firma RS256, issuer/audience/expiry/sub, permisos de Profile, rechazo cerrado y no redirects. Código preparado en la entrega local del Equipo 2.
- Equipo 3: SPA, obtención y envío del access token, sincronización de perfil, manejo de errores y transporte del navegador.
- Tech Lead: aprobar audiencia, matriz de permisos y actualización de docs/03-contratos-tecnicos.md.

Prueba manual pendiente: reiniciar los servicios con las ramas de pruebas, iniciar sesión, crear/unirse/iniciar; revocar permiso en Profile y comprobar 403 sin cambiar sala; detener Profile y comprobar 503. Usar cuentas distintas en navegadores distintos. No ejecutar estas pruebas sobre la entrega del profesor sin coordinar los permisos.

Esta rama cubre la parte del issue 13 del Shell. El requisito adicional de una sola pestaña activa y el cierre completo de las partidas requieren revisiones independientes.
