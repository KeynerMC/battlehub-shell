import { resolve, watch } from 'aurelia';
import { HubConnectionState, type HubConnection } from '@microsoft/signalr';
import { IAuthService } from '../../auth/auth-service';
import { IProfileService } from '../../profile/profile-service';
import { IRemoteMatchmaking, MatchmakingError, type RemoteRoom } from '../../matchmaking/remote-matchmaking-service';
import type { GameHost } from '../../games/game-host';
import type { GameContext } from '../../games/game-contracts';
import { GAME_FINISHED, isGameEvent } from '../../games/game-events';
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
  public gameFinished = false;
  public finishPending = false;
  public notifyingFinish = false;
  private finishRequest?: GameContext;
  private removeGameEvents?: () => void;
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
  private dismissedRoom?: string;
  public canLoad(): boolean | string { return this.auth.user ? this.auth.mode === 'auth0' ? true : 'lobby' : 'login'; }
  public async attached(): Promise<void> {
    this.active = true;
    try {
      const [permissions, games] = await Promise.all([
        this.profiles.getPermissions(), this.profiles.getEnabledGames(),
      ]);
      if (!this.active) return;
      this.canCreate = permissions.includes('matches.create');
      this.games = games.filter(game => ['typing', 'trivia', 'memory'].includes(game.gameType)
        && permissions.includes(game.requiredPermission || `games.${game.gameType}.play`));
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
        const user = this.auth.user;
        const rooms = await this.service.list();
        if (!this.active || this.auth.user !== user) return;
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
        if (started && started.id !== this.dismissedRoom && !this.context && this.entering !== started.id) await this.openGame(started);
      } while (this.refreshAgain && this.active);
    } catch (error) {
      if (this.active) {
        if (error instanceof MatchmakingError && [401, 403].includes(error.status)) await this.closeGame();
        this.error = this.message(error);
      }
    }
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
    return this.run(async () => { await this.service.create(this.title, this.gameType, this.gameType === 'memory' ? 2 : Number(this.maxPlayers)); this.title = ''; this.showCreate = false; });
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
    if (this.entering || !this.active) return;
    const user = this.auth.user;
    if (!user) return;
    if (room.status !== 'Started' || !this.isMember(room) || this.context) return;
    this.entering = room.id;
    this.gameMessage = '';
    try {
      if (room.gameType === 'memory' && room.participants.length !== 2) throw new Error('Esta versión de Memory necesita exactamente dos participantes.');
      const remotes = await loadRemotesConfig();
      if (!this.active || this.auth.user !== user) return;
      if (!remotes[room.gameType]) {
        this.gameMessage = `La partida comenzó. El equipo de ${room.gameType} todavía no tiene un remote configurado.`;
        return;
      }
      const permissions = await this.profiles.getPermissions();
      if (!permissions.includes(`games.${room.gameType}.play`)) throw new Error('No tienes permiso para jugar esta partida.');
      if (!this.active || this.auth.user !== user) return;
      await this.mountGame(room);
    } catch (error) { if (this.active && this.auth.user === user) this.gameMessage = this.message(error); }
    finally { this.entering = undefined; }
  }
  private async mountGame(room: RemoteRoom): Promise<void> {
    const user = this.auth.user;
    const current = await this.service.get(room.id);
    if (!this.active || !user || this.auth.user !== user || this.context) return;
    if (current.status !== 'Started' || !this.isMember(current) || current.gameType !== room.gameType
      || (current.gameType === 'memory' && current.participants.length !== 2)) {
      this.pendingGame = undefined;
      throw new Error('La partida cambió. Actualiza las salas antes de abrir el juego.');
    }
    this.pendingGame = undefined;
    this.gameMessage = '';
    this.gameFinished = false;
    const context: GameContext = {
      matchId: current.id, gameType: current.gameType,
      currentUser: { id: user.id, displayName: user.displayName }, events: new EventTarget(),
    };
    const finished = (event: Event) => {
      if (!this.active || this.auth.user !== user || this.context !== context
        || !isGameEvent(event, context.matchId, context.gameType) || this.gameFinished) return;
      this.finishPending = true;
      void this.notifyGameFinished();
    };
    this.removeGameEvents?.();
    context.events!.addEventListener(GAME_FINISHED, finished);
    this.removeGameEvents = () => context.events!.removeEventListener(GAME_FINISHED, finished);
    this.finishPending = false;
    this.finishRequest = undefined;
    this.notifyingFinish = false;
    this.context = context;
    if (this.host) { this.host.context = this.context; await this.host.load(); }
  }
  public async notifyGameFinished(): Promise<void> {
    const context = this.context;
    const user = this.auth.user;
    if (!this.active || !context || !user || !this.finishPending || this.finishRequest === context || this.gameFinished) return;
    this.finishRequest = context;
    this.notifyingFinish = true;
    this.gameMessage = '';
    try {
      const current = await this.service.get(context.matchId);
      if (!this.active || this.context !== context || this.auth.user !== user) return;
      if (current.gameType !== context.gameType || !this.isMember(current)
        || !['Started', 'Finished'].includes(current.status)) throw new Error('La partida ya no permite esta notificacion.');
      if (current.status !== 'Finished') await this.service.notifyFinished(context.matchId);
      if (!this.active || this.context !== context || this.auth.user !== user) return;
      const confirmed = await this.service.get(context.matchId);
      if (!this.active || this.context !== context || this.auth.user !== user) return;
      if (confirmed.status !== 'Finished' || confirmed.gameType !== context.gameType || !this.isMember(confirmed)) {
        throw new Error('Matchmaking aun no confirma la finalizacion.');
      }
      this.gameFinished = true;
      this.finishPending = false;
    } catch {
      if (this.active && this.context === context && this.auth.user === user) {
        this.gameMessage = 'El juego aviso que termino, pero Matchmaking no confirmo la finalizacion. Puedes reintentar; no necesitas autorizar el juego otra vez.';
      }
    } finally {
      if (this.finishRequest === context) { this.finishRequest = undefined; this.notifyingFinish = false; }
    }
  }

  private async closeGame(): Promise<void> {
    try { await this.host?.exit(); } finally { this.onGameExit(); }
  }
  public onGameExit = () => {
    this.dismissedRoom = this.context?.matchId ?? this.dismissedRoom;
    this.removeGameEvents?.();
    this.removeGameEvents = undefined;
    this.finishPending = false;
    this.finishRequest = undefined;
    this.notifyingFinish = false;
    this.context = undefined;
    this.pendingGame = undefined;
    this.gameFinished = false;
  };

  @watch((page: MatchesPage) => page.auth.user)
  public sessionChanged(): void {
    if (!this.active) return;
    this.active = false;
    clearInterval(this.timer);
    this.rooms = [];
    this.games = [];
    this.canCreate = false;
    this.removeGameEvents?.();
    this.removeGameEvents = undefined;
    this.finishPending = false;
    this.finishRequest = undefined;
    this.notifyingFinish = false;
    this.context = undefined;
    this.pendingGame = undefined;
    void this.closeGame().catch(() => { this.error = 'No se pudo cerrar el juego anterior.'; });
    void this.connection?.stop().catch(() => { this.connectionStatus = 'Desconectado'; });
    this.error = 'La sesion cambio. Vuelve a entrar a las salas.';
  }
  public async detaching(): Promise<void> {
    this.active = false;
    clearInterval(this.timer);
    this.removeGameEvents?.();
    this.removeGameEvents = undefined;
    this.finishPending = false;
    this.finishRequest = undefined;
    this.notifyingFinish = false;
    this.context = undefined;
    this.pendingGame = undefined;
    try { await this.host?.exit(); } finally { await this.connection?.stop(); }
  }
  private message(error: unknown): string { return error instanceof Error ? error.message : 'No se pudo actualizar la sala.'; }
}
