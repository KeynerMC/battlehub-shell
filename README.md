# battlehub-shell

Shell Application de **BattleHub** — Equipo 3 (Grupo 1), curso de Paradigmas, UNA.

El Shell es la aplicación contenedora de la plataforma: login con Auth0, integración con Profile Service
y Matchmaking, carga dinámica de los microfrontends de los juegos (Module Federation), layout global,
menú y control de sesión única. Contratos: [battlehub-contracts](https://github.com/javiercoulon-public/battlehub-contracts).

## Versiones (ADR-003)

| Herramienta | Versión |
|---|---|
| Node.js | 24 LTS (`>=24.11.0 <25`, ver `.nvmrc`) |
| `aurelia` y `@aurelia/*` | `2.0.0-rc.2` exacta |
| Webpack | 5 |

Los equipos de juegos (4, 5 y 6) deben usar exactamente estas versiones.

## Cómo correrlo localmente

```bash
npm install
npm start          # http://localhost:4000
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo en el puerto 4000 |
| `npm run build` | Compilación de producción en `dist/` |
| `npm run lint` | ESLint + Stylelint |
| `npm test` | Lint + pruebas unitarias (Jest) |

## Estructura

```text
/src                → código fuente del Shell
/test               → pruebas unitarias
/poc                → prueba de concepto del ADR-003 (Module Federation)
/.github/workflows  → pipeline de CI (pendiente)
```

## Convenciones

- Commits en formato semántico (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`...).
- `main` protegida: todo cambio entra por Pull Request con CI en verde y al menos 1 aprobación.
