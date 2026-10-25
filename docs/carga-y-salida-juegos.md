# Carga y salida de juegos en Shell

Cambios del punto 3: Shell conserva el estado de carga, limite de diez segundos por intento y dos reintentos automaticos para errores de red. El usuario puede reintentar desde el aviso. Un modulo inexistente o incompatible no se reintenta automaticamente.

Se corrigieron estos casos:

- Una apertura fallida de sala ya no deja bloqueados los siguientes intentos.
- Cambiar de cuenta mientras se obtiene el token no abre una partida con la identidad anterior.
- Al cerrar un juego no vuelve a abrirse por la actualizacion automatica de salas; se puede usar Abrir juego para volver.
- Navegar fuera de salas cierra el host y la conexion de lobby. El modo demo tambien libera el host al salir.
- Cambiar o cerrar sesion cierra el juego observado por Aurelia. Las consultas pendientes no vuelven a mostrar salas de la cuenta anterior.
- Una respuesta 401 o 403 al actualizar salas cierra el juego activo. Un fallo de red no se interpreta como una revocacion de permisos.
- Si initialize falla despues de salir, se llama a dispose. Si start falla despues de una limpieza anterior, no se llama a dispose dos veces.
- Los errores al pausar o reanudar muestran un error de ciclo de vida y liberan el componente.
- Si dispose falla, se registra el error y se permite volver a las salas. Shell no puede garantizar que el juego haya cerrado recursos que su propio dispose no libera.

## Responsabilidad de los juegos

initialize, start y pause deben terminar o rechazar sus promesas; dispose debe cerrar conexiones SignalR, temporizadores y suscripciones, incluso tras una inicializacion parcial. No debe volver a iniciar trabajo una vez descartado el modulo. Shell no puede detener por fuerza una operacion interna del juego que no coopera con su ciclo de vida.

El cierre de la vista no elimina al participante ni finaliza la partida en el servidor.

## Verificacion

Las pruebas de Shell cubren cargas duplicadas, reintentos, timeout, respuesta tardia, fallos de initialize y start tras salir, fallo de pausa y limpieza, reabrir una sala y cambio de cuenta durante la apertura. La prueba conjunta con Typing, Trivia y Memory reales sigue pendiente de la compatibilidad del login y de comprobar sus metodos dispose.

Commit sugerido: fix: mejorar la carga y salida de los juegos
