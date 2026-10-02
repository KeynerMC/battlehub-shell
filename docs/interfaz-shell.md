# Interfaz del Shell

La interfaz toma como referencia las cuatro pantallas de Visily entregadas para BattleHub: bienvenida, inicio con sesión, catálogo y salas. Conserva el fondo oscuro, el acento violeta, las tarjetas ilustradas y la tabla de salas. Las ilustraciones del catálogo son SVG locales; el diseño no descarga fuentes ni imágenes de servicios externos.

## Pantallas

- Inicio: bienvenida pública y panel de usuario con resumen del catálogo, salas consultadas y acceso al perfil. Los errores de servicios muestran un aviso; el modo real no utiliza datos mock como respaldo.
- Juegos: búsqueda por nombre, filtros de tipo e integración, estados de carga y recuperación. El catálogo procede de Profile. La etiqueta Remote registrado indica una entrada en la configuración, no que se haya verificado la disponibilidad del servidor.
- Salas reales (`/matches`): búsqueda local, filtro por juego, participantes, capacidad, estados en español y confirmación antes de cancelar. El formulario conserva los campos title/gameType/maxPlayers del adaptador existente. SignalR y las comprobaciones del backend mantienen sus responsabilidades.
- Salas de prueba (`/lobby`): simulación identificada explícitamente, con creación y entrada al demo.
- Mi perfil y sesión: presentación común, permisos con etiquetas comprensibles y menú de cuenta. La sesión Auth0 conserva el flujo del proveedor; no se agrega un formulario propio de contraseña.
- Área de juego: el Shell mantiene el layout y el ciclo initialize/start/pause/dispose. El espacio del remote conserva un mínimo de 1024 × 700 y ofrece desplazamiento horizontal en pantallas pequeñas, junto con un aviso de escritorio.

## Alcance

Las cifras ficticias, rankings, amigos, torneos, desafíos diarios, salas privadas y acciones de espectador de los mockups no se incorporan como funciones disponibles. El resumen de salas es una consulta al entrar a Inicio, no un indicador global de jugadores conectados. Las actualizaciones en vivo pertenecen a la pantalla de salas reales.

Los juegos se registran en la configuración existente de Module Federation. No se modifica GameContext, no se entrega un token a los juegos y no se incorpora el callback `/finish`. ADR-004 y ADR-007 siguen siendo propuestas en la documentación consultada. El rediseño no publica ni cambia los backends de otros equipos.

## Verificación

```powershell
npm test -- --runInBand --coverage=false
npm run build
```

Desde `e2e/`:

```powershell
npm test
```

Las pruebas de navegador usan el modo mock y el remote demo. Cubren navegación, catálogo y filtros, cierre de sesión, creación/salida de sala, carga/pausa/reanudación del juego y recuperación ante un remote inaccesible. Generan capturas de las pantallas en escritorio (1366 × 768) y móvil (390 × 844) bajo `e2e/test-results/`, sin versionarlas.

La sesión mock se pierde al recargar: las pruebas visuales navegan mediante el router para conservarla. La integración con cuentas reales de Auth0 y con los servicios de los equipos requiere una verificación conjunta separada.
