// Dependencias compartidas por el Shell y todos los microfrontends (ADR-003).
// Versión exacta de Aurelia fijada para todo el proyecto.
const AURELIA_VERSION = '2.0.0-rc.2';
const pkgs = [
  'aurelia',
  '@aurelia/kernel',
  '@aurelia/metadata',
  '@aurelia/platform',
  '@aurelia/platform-browser',
  '@aurelia/expression-parser',
  '@aurelia/template-compiler',
  '@aurelia/runtime',
  '@aurelia/runtime-html',
];
module.exports = Object.fromEntries(pkgs.map(p => [p, {
  singleton: true,
  strictVersion: true,
  requiredVersion: AURELIA_VERSION,
}]));
