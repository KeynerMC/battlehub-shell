# Auth0 y Profile Service

## Estado

El Shell tiene dos modos explícitos. `mock` conserva el recorrido de demostración y
no envía peticiones a Profile. `auth0` usa Universal Login y la API del Equipo 1.
Un error del modo real nunca activa el mock. Matchmaking, sesión única entre pestañas
y juegos reales siguen pendientes; las rutas de salas/demo quedan limitadas al modo mock.

El adaptador se contrastó con `OAiza/battlehub-profile-service`, commit `897c6b2`.
Las pruebas automatizadas sustituyen el proveedor y HTTP. La comprobación de punta
a punta con el tenant y la API reales requiere la configuración compartida.

## Configurar el Shell

En PowerShell, desde la raíz de battlehub-shell, copiar el ejemplo solo si aún no
existe la configuración local:

```powershell
if (-not (Test-Path .env.development)) { Copy-Item .env.example .env.development }
```

Editar `.env.development`:

- `BATTLEHUB_AUTH_MODE=auth0`
- `AUTH0_DOMAIN`: hostname exacto del tenant compartido, sin `https://` ni `/`.
- `AUTH0_CLIENT_ID`: Client ID de la aplicación SPA BattleHub Shell.
- `AUTH0_AUDIENCE`: Identifier de la API acordada con Equipo 1, no el Client ID.
- `PROFILE_SERVICE_URL`: origen completo de su API, sin `/api/profiles`.
  El puerto HTTP provisional de su repo es `http://localhost:5220`; confirmar el
  protocolo real antes de usarlo, porque la API incluye redirección HTTPS.

`npm start` lee `.env.development`. `npm run build` lee `.env` (o variables del
entorno de compilación, que tienen prioridad). Reiniciar Webpack o recompilar
después de cambiar valores. Sin configuración se utiliza `.env.example` (mock).
La configuración se incluye en el bundle público: no agregar Client Secret,
tokens, credenciales MySQL ni secretos de administración. El SDK conserva tokens
en memoria y administra su renovación; el Shell no los registra en consola.

## Auth0: aplicación dentro del tenant compartido

Equipo 1 administra el tenant. Equipo 3 configura su aplicación SPA y el login.
Para ejecutar el Shell en el puerto 4000, registrar en Settings de BattleHub Shell:

| Campo | Valor local |
|---|---|
| Allowed Callback URLs | `http://localhost:4000` |
| Allowed Logout URLs | `http://localhost:4000` |
| Allowed Web Origins | `http://localhost:4000` |

El callback es la raíz: el SDK procesa `code/state` antes de arrancar Aurelia y
limpia los parámetros. No hace falta una ruta `/callback`. El logout regresa al
mismo origen. Para despliegue registrar el origen HTTPS definitivo del Shell.
No se redirige a destinos recibidos del exterior.

Se solicitan los scopes OIDC `openid profile email`. Los permisos de juegos se
consultan en Profile; no se convierten automáticamente en scopes OAuth. Si el
backend incorpora scopes adicionales, deben acordarse antes de implementarlos.
Al recargar se intenta restaurar la sesión con el SDK. Si las políticas del
navegador impiden restaurarla, el usuario puede iniciar sesión nuevamente.
No se habilitaron refresh tokens: requieren configuración coordinada del tenant.

## Peticiones y modelos

Al entrar con Auth0, el Shell ejecuta una sincronización compartida entre las páginas:

1. `POST /api/profiles/sync`, cuerpo `{ displayName, email? }`.
2. `GET /api/profiles/me`.
3. `GET /api/profiles/me/permissions` y `GET /api/profiles/me/games`.

Todas envían `Authorization: Bearer <access_token>`. Nunca se envía el ID Token
como autorización ni un identificador de usuario elegido en el cuerpo de sync.
El backend usa el `sub/nameidentifier` del token como ID de perfil.

| Respuesta actual del Equipo 1 | Uso en Shell |
|---|---|
| Perfil: `id`, `displayName`, `email`, `createdAt`, `lastLoginAt` | Pantalla de perfil; se verifica que el ID corresponda a la sesión |
| Permisos: `{ permissions: string[] }` | Pantalla de permisos |
| Juegos: `[{ gameType, name, requiredPermission }]` | Catálogo real; no se inventa una descripción ni disponibilidad de partidas |

Los modelos internos del Shell se adaptan a estos DTOs. Si cambia el servicio,
contrastar el cambio con Contracts y actualizar este adaptador; el mock no define
el contrato de otros equipos. La autorización efectiva corresponde al backend.

La sesión Auth0 permanece iniciada cuando Profile falla. Se muestra un aviso con
reintento; no se publica un perfil parcialmente cargado. Las peticiones HTTP tienen
15 segundos de timeout. Los errores 400/401/403/404, servidor, red y JSON inválido
tienen mensajes controlados. El cierre/cambio de sesión invalida la caché y evita
que una petición anterior publique información de otro usuario.

## Pendientes para coordinar con Equipo 1

- Entregar Domain y Audience definitivos y confirmar el Client ID del Shell en ese tenant.
- Confirmar la URL de la API y permitir el origen del Shell mediante CORS, incluyendo
  GET, POST, Authorization y Content-Type/preflight. `AllowedHosts=*` no configura CORS.
- Para MySQL configurar `DatabaseProvider=MySQL`, conexión y aplicar migraciones.
  En el commit revisado, si no se configura el proveedor se usa InMemory.
- Confirmar que el catálogo inicial está creado. `HasData` por sí solo no garantiza
  que el arranque InMemory cargue los juegos; un catálogo vacío no prueba un fallo del Shell.
- Confirmar la política de asignación de permisos: actualmente el servicio asigna
  todos los permisos existentes al crear un perfil.
- Revisar la validación de `displayName/email` en sync. El correo enviado por el
  navegador es un dato editable, no prueba de correo verificado ni autorización.

## Comprobación conjunta

Con la API configurada y encendida, abrir el Shell y pulsar Iniciar sesión.
Al volver, comprobar el perfil y que los cuatro endpoints respondan 200/201 en la
pestaña Network, sin compartir tokens. Probar recarga, cerrar sesión, entrar con
otro usuario y que no se conserve el perfil anterior. Detener la API, comprobar el
aviso y restaurarla para probar Reintentar sincronización.

## Pruebas locales y CI

Desde la raíz: `npm test -- --runInBand` y `npm run build`.
Desde `e2e/`: `npm test`. Playwright fuerza `BATTLEHUB_AUTH_MODE=mock` para preservar
el recorrido de integración con el juego demo aunque exista un `.env.development`
real. No utiliza credenciales Auth0. Las pruebas unitarias cubren callback, renovación,
logout, DTOs, orden de sincronización, errores HTTP y cambio de sesión durante una petición.

Fuentes: [contratos técnicos](https://github.com/javiercoulon-public/battlehub-contracts/blob/main/docs/03-contratos-tecnicos.md),
[Profile Service](https://github.com/OAiza/battlehub-profile-service/tree/897c6b2),
[SDK Auth0](https://auth0.com/docs/libraries/auth0-single-page-app-sdk).
