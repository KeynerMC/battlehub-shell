# Actualizacion local de juegos - 25 de octubre de 2026


> **Documento historico conservado el 10 de noviembre de 2026.** Describe una revision anterior, no el contrato vigente ni evidencia de pruebas actuales. Para integrar usar el README y los tipos de `src/games`: los juegos reciben contexto y eventos sin proveedores de tokens; Shell notifica el fin a Matchmaking. Las referencias antiguas a Node 24, tokens por juego, permisos en Matchmaking o callbacks M2M de los juegos quedan superadas por el contrato de Etapa 2.

Se descargaron los remotos y se actualizaron por fast-forward las carpetas habituales. No se uso la carpeta etapa2 y no se hicieron cambios propios al codigo de los otros equipos ni push de sus repositorios.

| Carpeta | HEAD igual a origin/main | Resultado |
| --- | --- | --- |
| battlehub-typing-integration | 7692d37 | Ya estaba al dia |
| battlehub-trivia-integration | 90c7bcd | Incorporados 41 commits |
| battlehub-memory-integration | b94e23f | Incorporados 16 commits |

Typing conserva su rama feature/conexion: puede aparecer ahead 3 respecto a origin/feature/conexion, pero coincide con origin/main. Memory conserva fix/pruebas-memory-aurelia. Trivia conserva main.

## Respaldos de trabajo local

Los cambios locales previos se guardaron con git stash push --include-untracked antes de actualizar. Los respaldos NO se reaplicaron: las carpetas quedan con los archivos versionados del ultimo main. Los archivos ignorados, dependencias y configuracion local no se limpian ni se sincronizan mediante este procedimiento.

| Repositorio | Stash conservado |
| --- | --- |
| Trivia | d4f1b472673cc8cb55bbe9bf3e3ced784b5288cc |
| Memory | b49cf08e87e1ec566aa9eb44cc854c811973d635 |

Ambos tienen el mensaje respaldo-local-antes-actualizar-juegos-20261025. Se pueden consultar con git stash list y git stash show desde su repositorio. No aplicar ni borrar sin revisar conflictos con el nuevo main. En Trivia, el documento local anterior integracion-shell-auth0.md fue eliminado por upstream y reemplazado por integracion-shell-matchmaking.md.

## Validacion y alcance

Se verifico HEAD...origin/main = 0 0 y git status --porcelain vacio en los tres repositorios. No se iniciaron servicios, aplicaron migraciones ni ejecutaron pruebas de los juegos. Una actualizacion de Git no confirma que funcionen con las bases de datos y configuraciones locales existentes.

Las indicaciones de autenticacion estan en login-unico-juegos.md. La novedad principal es el cambio de Trivia a validacion JWT con clave publica local; requiere acordar la compatibilidad con el token del Shell.
