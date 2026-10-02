# Shell de pruebas (ADR-003)

Herramienta para que los **Equipos 4, 5 y 6** prueben su juego **dentro de un Shell** sin esperar
al Shell real. Hace lo mismo que hará el Shell de BattleHub: descarga su `remoteEntry.js`,
revisa que cumpla el contrato y llama a `initialize`, `start`, `pause` y `dispose`.

## Cómo usarlo

1. Tengan su juego corriendo en su puerto (`npm start` en el repo del juego).
2. En otra terminal:

```bash
cd herramientas/shell-de-pruebas
npm install
npm start          # http://localhost:4000
```

3. En la página:
   1. Elijan su juego. La URL se llena sola (Typing 4001, Trivia 4002, Memory 4003); la pueden cambiar.
   2. Opcional: cambien el `matchId` y el nombre del jugador.
   3. Presionen **Cargar juego** y prueben los botones `pause()`, `start()` y `dispose()`.
   4. El **Registro** muestra cada paso y cada error.

## Qué revisar

| Si ven esto | Significa |
|---|---|
| "El módulo implementa initialize, start, pause y dispose" y el juego aparece | Todo bien: su juego cumple el contrato |
| `REMOTE_UNREACHABLE` | Su juego no está corriendo, el puerto o la URL están mal, o falta CORS |
| `INVALID_MODULE` | No exportan una clase `GameModule`, o le falta alguno de los 4 métodos |
| `LIFECYCLE_ERROR` | Su `initialize()` o `start()` lanzó un error (revisen la consola del navegador) |
| Error sobre versiones de Aurelia en la consola | No usan `2.0.0-rc.2` exacta o cambiaron `mf-shared.js` |

## Notas

- Si ya cargaron un juego y cambian su URL, recarguen la página (F5).
- Las URLs por defecto están en `config/remotes.local.json`.
- Es una herramienta de pruebas, no el Shell final: no tiene login ni conexión con Matchmaking.
