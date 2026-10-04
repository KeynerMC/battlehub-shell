import { resolve } from 'aurelia';
import { HubConnectionState, type HubConnection } from '@microsoft/signalr';
import { IAuthService } from '../../auth/auth-service';
import { IProfileService } from '../../profile/profile-service';
import { IRemoteMatchmaking, MatchmakingError, type RemoteRoom } from '../../matchmaking/remote-matchmaking-service';
import type { GameHost } from '../../games/game-host';
import type { GameContext } from '../../games/game-contracts';
import { loadRemotesConfig } from '../../games/remote-loader';
import { roomStatus } from '../../games/game-presentation';

export class MatchesPage {
  public readonly auth = resolve(IAuthService);
  public readonly service = resolve(IRemoteMatchmaking);
  private readonly profiles = resolve(IProfileService);
  public rooms: RemoteRoom[] = [];
  public games: { gameType: string; name: string }[] = [];
  public title = '';
  public gameType = '';
  public maxPlayers = 2;
  public error = '';
  public connectionStatus = '';
  public busy = false;
  public canCreate = false;
  public host?: GameHost;
  public context?: GameContext;
  public gameMessage = '';
  public pendingGame?: RemoteRoom;
  public authorizingGame = false;
  public gameFinished = false;
  public query = '';
  public filterGame = '';
  public showCreate = false;
  public pendingCancel?: RemoteRoom;
  public readonly statusLabel = roomStatus;
  public get filteredRooms(): RemoteRoom[] {
    const query = this.query.trim().toLocaleLowerCase();
    return this.rooms.filter(room => (!query || room.title.toLocaleLowerCase().includes(query)) &&
      (!this.filterGame || room.gameType === this.filterGame));
  }
  public ownerName(room: RemoteRoom): string {
    return room.participants.find(player => player.userId === room.createdBy)?.displayName ?? 'Anfitrión fuera de la sala';
  }
  private connection?: HubConnection;
  private timer?: ReturnType<typeof setInterval>;
  private active = false;
  private refreshing = false;
  private refreshAgain = false;
  private entering?: string;
  public canLoad(): boolean | string { return this.auth.user ? this.auth.mode === 'auth0' ? true : 'lobby' : 'login'; }
  public async attached(): Promise<void> {
    this.active = true;
    try {
      const permissions = await this.profiles.getPermissions();
      if (!this.active) return;
      this.canCreate = permissions.includes('matches.create');
      // Permite probar las salas aunque el catálogo aún no tenga registros ni remotes.
      this.games = [{ gameType: 'typing', name: 'Typing Battle' }, { gameType: 'trivia', name: 'Trivia Battle' },
        { gameType: 'memory', name: 'Memory Match' }].filter(g => permissions.includes(`games.${g.gameType}.play`));
      this.gameType = this.games[0]?.gameType || '';
      await this.connect();
      await this.refresh();
      if (this.active) this.timer = setInterval(() => { void this.heartbeat(); void this.refresh(); }, 20000);
    } catch (error) { this.error = this.message(error); }
  }
  public isMember(room: RemoteRoom): boolean { return room.participants.some(p => p.userId === this.auth.user?.id); }
  public isOwner(room: RemoteRoom): boolean { return room.createdBy === this.auth.user?.id; }
  public async connect(): Promise<void> {
    if (this.connection && this.connection.state !== HubConnectionState.Disconnected) return;
    this.connectionStatus = 'Conectando…';
    try {
      this.connection ??= this.service.connection(() => { if (this.active) void this.refresh(); }, value => { if (this.active) this.connectionStatus = value; });
      await this.connection.start();
      if (!this.active) { await this.connection.stop(); return; }
      await this.connection.invoke('JoinLobby');
      this.connectionStatus = 'Conectado';
      await this.heartbeat();
    } catch { this.connectionStatus = 'Sin conexión en vivo. Comprueba el servicio y pulsa Conectar.'; }
  }
  public async refresh(): Promise<void> {
    if (!this.active) return;
    if (!this.auth.user) {
      this.rooms = [];
      this.games = [];
      this.canCreate = false;
      this.context = undefined;
      await this.host?.exit();
      await this.connection?.stop();
      this.error = 'Vuelve a iniciar sesión para consultar las salas.';
      return;
    }
    if (this.refreshing) { this.refreshAgain = true; return; }
    this.refreshing = true;
    try {
      do {
        this.refreshAgain = false;
        const rooms = await this.service.list();
        if (!this.active) return;
        this.rooms = rooms;
        if (this.context && !this.gameFinished && !rooms.some(r => r.id === this.context?.matchId && r.status === 'Started' && this.isMember(r))) {
          try {
            const detail = await this.service.get(this.context.matchId);
            if (!this.active) return;
            if (detail.status === 'Finished' && this.isMember(detail)) this.gameFinished = true;
            else if (detail.status !== 'Started' || !this.isMember(detail)) await this.closeGame();
          } catch (error) {
            if (error instanceof MatchmakingError && error.status === 404) await this.closeGame();
            else throw error;
          }
        }
        if (this.pendingGame && !rooms.some(r => r.id === this.pendingGame?.id && r.status === 'Started' && this.isMember(r))) {
          this.pendingGame = undefined;
          this.gameMessage = '';
        }
        const started = rooms.find(r => r.status === 'Started' && this.isMember(r));
        if (started && !this.context && this.entering !== started.id) await this.openGame(started);
      } while (this.refreshAgain && this.active);
    } catch (error) { if (this.active) this.error = this.message(error); }
    finally { this.refreshing = false; }
  }
  private async heartbeat(): Promise<void> {
    if (!this.active || this.connection?.state !== HubConnectionState.Connected) return;
    for (const room of this.rooms.filter(r => this.isMember(r))) {
      try { await this.connection.invoke('Heartbeat', room.id); }
      catch { if (this.active) this.connectionStatus = 'No se pudo renovar la presencia en una sala. Actualiza la lista.'; }
    }
  }
  public create(): Promise<void> {
    return this.run(async () => { await this.service.create(this.title, this.gameType, Number(this.maxPlayers)); this.title = ''; this.showCreate = false; });
  }
  public act(room: RemoteRoom, action: 'join' | 'leave' | 'start' | 'cancel'): Promise<void> {
    return this.run(async () => { await this.service.action(room.id, action); });
  }
  public async confirmCancel(): Promise<void> {
    if (!this.pendingCancel) return;
    await this.act(this.pendingCancel, 'cancel');
    this.pendingCancel = undefined;
  }
  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try { await action(); await this.refresh(); await this.heartbeat(); }
    catch (error) { this.error = this.message(error); }
    finally { this.busy = false; }
  }
  public async openGame(room: RemoteRoom): Promise<void> {
    if (room.status !== 'Started' || !this.isMember(room) || this.context) return;
    this.entering = room.id;
    this.gameMessage = '';
    try {
      const remotes = await loadRemotesConfig();
      if (!this.active || !this.auth.user) return;
      if (!remotes[room.gameType]) {
        this.gameMessage = `La partida comenzó. El equipo de ${room.gameType} todavía no tiene un remote configurado.`;
        return;
      }
      if (room.gameType === 'typing') {
        this.pendingGame = room;
        if (!this.auth.getGameAccessToken) throw new Error('El Shell no dispone de autorización para Typing.');
        await this.auth.getGameAccessToken('typing');
      }
      await this.mountGame(room);
    } catch (error) { if (this.active) this.gameMessage = this.message(error); }
  }
  private async mountGame(room: RemoteRoom): Promise<void> {
    const user = this.auth.user;
    const current = await this.service.get(room.id);
    if (!this.active || !user || this.auth.user !== user || this.context) return;
    if (current.status !== 'Started' || !this.isMember(current) || current.gameType !== room.gameType) {
      this.pendingGame = undefined;
      throw new Error('La partida cambió. Actualiza las salas antes de abrir el juego.');
    }
    this.pendingGame = undefined;
    this.gameMessage = '';
    this.gameFinished = false;
    const context: GameContext = { matchId: current.id, gameType: current.gameType, currentUser: { id: user.id, displayName: user.displayName },
      ...(current.gameType === 'typing' ? { getAccessToken: async () => {
        if (!this.active || this.auth.user !== user || this.context !== context) throw new Error('La sesión cambió o el juego se cerró.');
        const token = await this.auth.getGameAccessToken!('typing');
        if (!this.active || this.auth.user !== user || this.context !== context) throw new Error('La sesión cambió o el juego se cerró.');
        return token;
      } } : {}) };
    this.context = context;
    if (this.host) { this.host.context = this.context; await this.host.load(); }
  }
  public async authorizeGame(): Promise<void> {
    const room = this.pendingGame;
    if (!room || this.authorizingGame || !this.auth.getGameAccessToken) return;
    this.authorizingGame = true;
    try {
      await this.auth.getGameAccessToken(room.gameType, true);
      if (!this.active || this.pendingGame !== room || this.context) return;
      await this.mountGame(room);
    } catch (error) { if (this.active) this.gameMessage = this.message(error); }
    finally { this.authorizingGame = false; }
  }
  private async closeGame(): Promise<void> {
    await this.host?.exit();
    this.onGameExit();
  }
  public onGameExit = () => { this.context = undefined; this.gameFinished = false; };
  public async detaching(): Promise<void> {
    this.active = false;
    clearInterval(this.timer);
    await this.connection?.stop();
  }
  private message(error: unknown): string { return error instanceof Error ? error.message : 'No se pudo actualizar la sala.'; }
}
