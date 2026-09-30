// Resolver las dependencias compartidas antes de iniciar Aurelia.
import('./bootstrap').catch(error => {
  console.error('No se pudo iniciar BattleHub', error);
  const host = document.querySelector('my-app');
  if (host) host.textContent = 'No se pudo iniciar BattleHub. Recarga la página.';
});
