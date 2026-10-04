const games: Record<string, { category: string; description: string }> = {
  typing: { category: 'Velocidad', description: 'Pon a prueba tu precisión y velocidad de escritura.' },
  trivia: { category: 'Conocimiento', description: 'Cada pregunta es una nueva oportunidad de demostrar lo que sabes.' },
  memory: { category: 'Memoria', description: 'Encuentra las parejas y desafía tu memoria visual.' },
  demo: { category: 'Demostración', description: 'Prueba el recorrido completo con un juego de demostración.' },
};

export function gamePresentation(gameType: string) {
  return games[gameType] ?? { category: 'Juego', description: 'Explora este juego desde una sala de BattleHub.' };
}

export function gameArtwork(gameType: string): string {
  return ['typing', 'trivia', 'memory', 'demo'].includes(gameType) ? `art-${gameType}` : 'art-demo';
}

export function roomStatus(status: string): string {
  return ({ Waiting: 'En espera', Starting: 'Iniciando', Started: 'En curso', Finished: 'Finalizada', Cancelled: 'Cancelada' } as Record<string, string>)[status] ?? status;
}

export function permissionLabel(permission: string): string {
  return ({ 'matches.create': 'Crear salas', 'games.typing.play': 'Jugar Typing Battle',
    'games.trivia.play': 'Jugar Trivia Battle', 'games.memory.play': 'Jugar Memory Match' } as Record<string, string>)[permission] ?? 'Acceso adicional';
}
