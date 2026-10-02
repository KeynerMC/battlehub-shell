import { DI } from 'aurelia';
import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr';
import type { AuthService } from '../auth/auth-service';

export interface RemoteRoom {
  id: string; title: string; gameType: string; createdBy: string; createdAt: string;
  currentPlayers: number; maxPlayers: number; status: string;
  participants: { userId: string; displayName: string }[];
}
export const IRemoteMatchmaking = DI.createInterface<RemoteMatchmakingService>('IRemoteMatchmaking');
const events = ['MatchCreated', 'MatchUpdated', 'MatchDeleted', 'PlayerJoined', 'PlayerLeft', 'MatchStarting', 'MatchStarted', 'MatchFinished'];

export function parseRoom(value: unknown): RemoteRoom {
  const room = value as RemoteRoom;
  if (!room || typeof room !== 'object' ||
      !['id', 'title', 'gameType', 'createdBy', 'createdAt', 'status'].every(key => typeof (room as unknown as Record<string, unknown>)[key] === 'string') ||
      !Number.isInteger(room.currentPlayers) || !Number.isInteger(room.maxPlayers) ||
      !['Waiting', 'Starting', 'Started', 'Finished', 'Cancelled'].includes(room.status) ||
      !Array.isArray(room.participants) || room.participants.some(p => !p || typeof p.userId !== 'string' || typeof p.displayName !== 'string')) {
    throw new Error('Respuesta de Matchmaking incompatible.');
  }
  return room;
}

export class RemoteMatchmakingService {
  public constructor(private readonly auth: AuthService, private readonly origin?: string) {}
  public get configured(): boolean { return !!this.origin; }
  private async request(path = '', method = 'GET', body?: unknown): Promise<unknown> {
    if (!this.origin) throw new Error('Falta configurar MATCHMAKING_SERVICE_URL y reiniciar el Shell.');
    const user = this.auth.user;
    if (!user) throw new Error('Inicia sesión para consultar las salas.');
    const token = await this.auth.getAccessToken();
    if (this.auth.user !== user) throw new Error('La sesión cambió.');
    let response: Response;
    try {
      response = await fetch(`${this.origin}/api/matches${path}`, {
        method, signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store', credentials: 'omit',
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw new Error('No se pudo conectar con Matchmaking. Revisa el servicio y CORS.'); }
    if (this.auth.user !== user) throw new Error('La sesión cambió.');
    if (!response.ok) {
      const messages: Record<number, string> = {
        400: 'Revisa el título, juego y capacidad de la sala.', 401: 'Matchmaking rechazó la sesión. Revisa Auth0 y la audiencia del servicio.',
        403: 'No tienes permiso para esta acción.', 404: 'La sala ya no existe.',
        409: 'La sala cambió, está llena o no cumple las condiciones. Actualiza; para iniciar se requieren dos jugadores y el anfitrión.',
        503: 'Matchmaking no puede acceder a MongoDB o Profile Service.',
      };
      throw new Error(messages[response.status] || `Matchmaking respondió con error (${response.status}).`);
    }
    const result: unknown = await response.json();
    if (this.auth.user !== user) throw new Error('La sesión cambió.');
    return result;
  }
  public async list(): Promise<RemoteRoom[]> {
    const rooms = await this.request();
    if (!Array.isArray(rooms)) throw new Error('Lista de salas incompatible.');
    return rooms.map(parseRoom);
  }
  public async create(title: string, gameType: string, maxPlayers: number): Promise<RemoteRoom> {
    return parseRoom(await this.request('', 'POST', { title, gameType, maxPlayers }));
  }
  public async action(id: string, action: 'join' | 'leave' | 'start' | 'cancel'): Promise<RemoteRoom> {
    return parseRoom(await this.request(`/${encodeURIComponent(id)}${action === 'cancel' ? '' : '/' + action}`, action === 'cancel' ? 'DELETE' : 'POST'));
  }
  public connection(changed: () => void, status: (message: string) => void): HubConnection {
    if (!this.origin) throw new Error('Falta configurar MATCHMAKING_SERVICE_URL.');
    const user = this.auth.user;
    const connection = new HubConnectionBuilder().withUrl(`${this.origin}/hubs/lobby`, {
      accessTokenFactory: async () => {
        if (!user || this.auth.user !== user) throw new Error('La sesión cambió.');
        const token = await this.auth.getAccessToken();
        if (this.auth.user !== user) throw new Error('La sesión cambió.');
        return token;
      },
    }).withAutomaticReconnect().configureLogging(LogLevel.None).build();
    for (const event of events) connection.on(event, changed);
    connection.onreconnecting(() => status('Reconectando las actualizaciones en vivo…'));
    connection.onreconnected(async () => {
      try { await connection.invoke('JoinLobby'); status('Conectado'); changed(); }
      catch { status('No se pudo recuperar la suscripción. Vuelve a conectar.'); }
    });
    connection.onclose(() => status('Sin conexión en vivo. Pulsa Conectar.'));
    return connection;
  }
}
