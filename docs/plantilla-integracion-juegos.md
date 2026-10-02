# Conectar Typing, Trivia y Memory con el Shell

Guía del Equipo 3 para los Equipos 4, 5 y 6, basada en la copia local del Shell revisada el 2026-10-02. Cada equipo adapta su propio repositorio y entrega al Equipo 3 los datos de conexión. El Equipo 3 registra y prueba el remote en el Shell.

Esta guía describe compatibilidad con nuestra implementación local, no una integración publicada. Los contratos centrales siguen siendo la referencia. ADR-003 figura como **Propuesto** en la copia consultada, aunque existe una plantilla y el Shell implementa ese mecanismo. ADR-004 y ADR-007 también están Propuestos; esta guía no los aprueba ni amplía sus decisiones a los juegos.

## 1. Qué conecta cada equipo

El Shell carga el frontend del juego mediante Module Federation. Después, el juego se conecta a su propia API y a su propio hub. El Shell conserva el login, la navegación y el área donde se muestra el juego.

| Equipo | `gameType` | Contenedor del remote (`scope` / `name`) | Puerto frontend de referencia | Hub propio |
|---|---|---|---|---|
| 4: Typing | `typing` | `typingGame` | 4001 | `/hubs/typing` |
| 5: Trivia | `trivia` | `triviaGame` | 4002 | `/hubs/trivia` |
| 6: Memory | `memory` | `memoryGame` | 4003 | `/hubs/memory` |

Los nombres y puertos son los de la plantilla ADR-003. Si usan otros, deben informarlos para registrar los valores reales. El puerto de la API es independiente del puerto del frontend.

Actualmente solo está registrado `demo`, que también usa el puerto 4001. Para probar Typing en ese puerto, detener primero el demo o acordar otro puerto. Tener un registro en el catálogo de Profile no significa que el remote ya esté disponible.

## 2. Preparar el frontend del juego

Pueden tomar como base la [plantilla existente en contratos](https://github.com/javiercoulon-public/battlehub-contracts/blob/main/adrs/plantillas/ADR-003/juego-remote/README.md). Si ya tienen un juego, incorporen la configuración sin reemplazar sus archivos de trabajo.

La versión usada por el Shell local es `aurelia@2.0.0-rc.2`, con Node `>=24.11.0 <25` y Webpack 5. Para compartir Aurelia, usen versiones exactas compatibles y la configuración de [dependencias compartidas del Shell](../tooling/mf-shared.js). Informen cualquier paquete `@aurelia/*` adicional.

Ejemplo de la parte de Module Federation para Typing (se integra en su configuración completa de Webpack):

```javascript
const { ModuleFederationPlugin } = require('webpack').container;

new ModuleFederationPlugin({
  name: 'typingGame',
  filename: 'remoteEntry.js',
  exposes: { './GameModule': './src/game-module' },
  shared: require('./mf-shared'),
});
```

Configurar además `output.publicPath: 'auto'` y un `output.uniqueName` propio. El servidor del juego debe servir `remoteEntry.js`, sus chunks y assets. Su entrada `src/main.ts` usa el límite asíncrono:

```typescript
import('./bootstrap');
```

El módulo expuesto debe exportar una clase llamada **`GameModule`**, registrada como componente Aurelia. El Shell instancia esa clase y renderiza el componente dentro de su área; no deben arrancar otra aplicación Aurelia sobre el documento del Shell.

## 3. Contexto y ciclo de vida

El Shell entrega este contexto, definido en [game-contracts.ts](../src/games/game-contracts.ts):

```typescript
interface GameContext {
  matchId: string;
  gameType: string;
  currentUser: { id: string; displayName: string };
}

interface GameModule {
  initialize(context: GameContext): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  dispose(): Promise<void>;
}
```

| Método | Responsabilidad del juego |
|---|---|
| `initialize(context)` | Validar y guardar el contexto; preparar datos sin iniciar la partida |
| `start()` | Iniciar o reanudar; conectar recursos necesarios sin duplicar conexiones ni temporizadores |
| `pause()` | Pausar la actividad local que corresponda; no equivale a pausar a todos los jugadores en el backend |
| `dispose()` | Detener temporizadores, quitar listeners y cerrar conexiones propias; permitir limpieza incluso tras un inicio fallido |

Si falla la preparación o el arranque, rechazar la promesa para que el Shell muestre el error. Usar el `matchId` recibido; no generar otro identificador para representar la sala.

El contexto **no contiene access token, proveedor de tokens ni Client Secret**. `currentUser` sirve como contexto visual, no como prueba de identidad para el backend. Antes de integrar operaciones protegidas de la API o del hub del juego, hay que acordar con los Equipos 1 y 3 cómo obtener la autorización necesaria: el contrato actual no entrega ese mecanismo. La audiencia compartida propuesta en ADR-007 solo contempla Profile y Matchmaking.

## 4. Qué cambia el Equipo 3 en el Shell

Cuando entreguen un remote accesible, el Equipo 3 agrega su entrada en `config/remotes.local.json`. Este es un ejemplo de las tres entradas, no la configuración ya instalada:

```json
{
  "typing": { "scope": "typingGame", "url": "http://localhost:4001/remoteEntry.js", "module": "./GameModule" },
  "trivia": { "scope": "triviaGame", "url": "http://localhost:4002/remoteEntry.js", "module": "./GameModule" },
  "memory": { "scope": "memoryGame", "url": "http://localhost:4003/remoteEntry.js", "module": "./GameModule" }
}
```

Conservar las entradas existentes que se necesiten. Reiniciar el servidor del Shell después de cambiar la configuración. Webpack copia el archivo como `/remotes.config.json`; el navegador lo consulta para cargar los juegos.

Para producción se registran las URLs reales en `config/remotes.production.json` y se recompila el Shell, o se actualiza el archivo servido según el procedimiento de despliegue. No usar URLs locales como entrega de producción.

## 5. API, hub y presentación

Cada equipo mantiene su API .NET 10, su hub y la persistencia de resultados según los [contratos técnicos](https://github.com/javiercoulon-public/battlehub-contracts/blob/main/docs/03-contratos-tecnicos.md) y los [requisitos de persistencia por juego](https://github.com/javiercoulon-public/battlehub-contracts/blob/main/docs/04-persistencia-y-api-juegos.md). Entreguen la URL base de la API y la URL del hub por separado de `remoteEntry.js`.

Al ejecutarse dentro del Shell, las llamadas del navegador salen desde el origen del Shell (`http://localhost:4000` en desarrollo). Configuren CORS en su API/hub para ese origen y para los transportes y credenciales que utilicen. Que la API funcione desde el frontend independiente del juego no comprueba que funcione desde el Shell.

El juego renderiza dentro del espacio asignado. Evitar estilos globales sobre `body`, `html` o la navegación. Usar clases con prefijo del juego, conservar header/footer y comprobar la resolución mínima de 1366 × 768 del contrato.

Cerrar el microfrontend libera recursos locales; **no finaliza la partida en Matchmaking**. La copia local de Matchmaking no expone `/finish`. El mecanismo concreto de finalización debe coordinarse con el Equipo 2 y el Tech Lead; el callback propuesto en ADR-004 no se debe presentar como disponible.

## 6. Plantilla de entrega al Equipo 3

Cada equipo puede copiar y completar esta ficha:

```text
Equipo y responsable:
Juego / gameType:
Repositorio:
Rama y commit que debemos probar:
Carpeta del frontend:
Versión de Node:
Versiones de Aurelia y paquetes adicionales @aurelia/*:
Comando para instalar dependencias:
Comando para iniciar el frontend:
URL local de remoteEntry.js:
Scope / name de Module Federation:
Módulo expuesto: ./GameModule
Exportación: GameModule
URL de producción del remote (o pendiente):
Carpeta y comando de arranque de la API:
URL base de la API:
URL completa del hub:
Base de datos y pasos de preparación:
Variables necesarias (nombres y valores públicos de ejemplo):
Autenticación de API/hub: acordada o pendiente; describir mecanismo:
Origen del Shell permitido por CORS:
Pruebas ejecutadas y resultado:
Qué funciona y qué sigue pendiente:
```

No incluir secretos ni tokens en la ficha. Cada equipo revisa y publica sus propios cambios; esta guía y una prueba en la copia local no publican nada en sus repositorios.

## 7. Prueba conjunta

1. El equipo del juego inicia su frontend, API, hub y base de datos. Comprobar que `remoteEntry.js` responde con JavaScript y que los chunks se descargan.
2. El Equipo 3 registra el remote y arranca el Shell. Para el recorrido real, arrancar también Profile, Matchmaking y MongoDB según la [guía local de salas](matchmaking-integration.md).
3. Entrar con dos cuentas en navegadores separados. Los usuarios necesitan el permiso `games.<gameType>.play`; el anfitrión también necesita `matches.create`.
4. Crear una sala del juego en `/matches`, unir al segundo usuario e iniciar como anfitrión. El Shell intenta abrir el remote para los participantes al detectar la sala iniciada; también ofrece el botón Abrir juego.
5. Confirmar que ambos juegos reciben el mismo `matchId`, el `gameType` correcto y el usuario correspondiente. Comprobar API/hub con el mecanismo de autenticación acordado.
6. Cerrar y volver a abrir el juego: verificar que no queden conexiones, listeners o temporizadores duplicados. Probar el fallo del servidor del remote y el reintento desde el Shell.
7. Registrar el commit probado, resultados y pendientes. Comprobar persistencia e historial en la API del juego; la carga visual por sí sola no valida el multijugador ni los resultados.

| Problema | Qué revisar |
|---|---|
| El Shell indica remote no configurado | Entrada con la clave exacta `typing`, `trivia` o `memory` |
| No descarga el remote o sus chunks | URL, servidor, `publicPath`, archivos publicados y conflicto con puerto del demo |
| No aparece el contenedor o la clase | `scope` igual a `name`, `./GameModule` expuesto y exportación `GameModule` |
| Error de versión o dependencia compartida | Versiones exactas de Aurelia y configuración `shared` |
| Error en preparación o arranque | Promesas de `initialize`/`start`, contexto y disponibilidad de API/hub |
| API/hub responde 401, 403 o falla CORS | Autenticación acordada, permisos y origen real del Shell |

## Referencias de esta copia

- [Carga dinámica de remotes](../src/games/remote-loader.ts).
- [GameHost y ciclo de vida](../src/games/game-host.ts).
- [ADR-003 y plantilla de referencia](https://github.com/javiercoulon-public/battlehub-contracts/blob/main/adrs/ADR-003-integracion-module-federation-aurelia-shell.md).
- [ADR-004: propuesta de finalización](https://github.com/javiercoulon-public/battlehub-contracts/blob/main/adrs/ADR-004-ciclo-vida-limpieza-matchmaking.md).
- [ADR-007: propuesta para Profile y Matchmaking](https://github.com/javiercoulon-public/battlehub-contracts/pull/10).
