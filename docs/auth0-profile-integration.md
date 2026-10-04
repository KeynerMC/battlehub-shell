# Auth0 y Profile Service

## Configuración

Copiar `.env.example` a `.env.development` si el archivo local todavía no existe:

```powershell
if (-not (Test-Path .env.development)) {
    Copy-Item .env.example .env.development
}
```

Configurar estas variables:

| Variable | Valor |
|---|---|
| `BATTLEHUB_AUTH_MODE` | `auth0` para servicios reales; `mock` para la demo |
| `AUTH0_DOMAIN` | Dominio del tenant, sin `https://` ni rutas |
| `AUTH0_CLIENT_ID` | Client ID de la aplicación SPA del Shell |
| `AUTH0_AUDIENCE` | Identifier de la API acordada con Equipo 1 |
| `PROFILE_SERVICE_URL` | Origen de Profile Service; localmente `http://localhost:5220` |

`npm start` carga `.env.development`. El build de producción utiliza `.env` o variables del entorno de compilación. Reiniciar el servidor después de cambiar la configuración.

Las variables del frontend son públicas. No incluir Client Secret, tokens ni credenciales de bases de datos.

## Aplicación en Auth0

El Equipo 1 administra el tenant compartido. El Equipo 3 administra la aplicación SPA del Shell.

Para desarrollo local:

| Campo | URL |
|---|---|
| Allowed Callback URLs | `http://localhost:4000` |
| Allowed Logout URLs | `http://localhost:4000` |
| Allowed Web Origins | `http://localhost:4000` |

La aplicación debe tener autorizado el acceso delegado de usuario a la API solicitada. El SDK procesa el callback en la raíz antes de iniciar Aurelia. Se solicitan `openid profile email`; los permisos de negocio se consultan en Profile Service.

## Sincronización del perfil

Después del login, el Shell realiza:

1. `POST /api/profiles/sync` con `{ displayName, email? }`.
2. `GET /api/profiles/me`.
3. `GET /api/profiles/me/permissions` y `GET /api/profiles/me/games`.

Las peticiones llevan el access token como Bearer. El backend obtiene la identidad del token y el Shell comprueba que el perfil recibido corresponda al usuario autenticado.

| Recurso | Respuesta |
|---|---|
| Perfil | `id`, `displayName`, `email`, `createdAt`, `lastLoginAt` |
| Permisos | `{ permissions: string[] }` |
| Catálogo | `[{ gameType, name, requiredPermission }]` |

Si Profile Service falla, se mantiene la sesión y se permite reintentar la sincronización. Los tokens se conservan en memoria; al recargar, el SDK intenta recuperar la sesión.

## Requisitos del backend

- Validar el dominio y la audiencia correspondientes al token.
- Permitir el origen del Shell mediante CORS, incluyendo Authorization y Content-Type.
- Configurar MySQL y sus migraciones para persistencia. El proveedor InMemory es local y pierde datos al reiniciar.
- Cargar los registros del catálogo y asignar los permisos correspondientes. Un registro de catálogo no implica que su juego remoto esté disponible.

Para salas, consultar [Matchmaking](matchmaking-integration.md).

## Verificación

```powershell
npm test -- --runInBand
npm run build
```

Comprobar login, consulta del perfil, logout y cambio de usuario. Las pruebas de navegador en `e2e/` utilizan el modo mock; no validan la configuración del tenant real.
