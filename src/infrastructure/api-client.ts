export class ApiError extends Error {
  public constructor(public readonly status: number, message: string) { super(message); }
}

export class ApiClient {
  public constructor(private readonly origin: string, private readonly token: () => Promise<string>) {}

  public async request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
    const accessToken = await this.token();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(this.origin + path, {
        method, signal: controller.signal, redirect: 'error', cache: 'no-store', credentials: 'omit',
        headers: {
          Accept: 'application/json', Authorization: `Bearer ${accessToken}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) {
        const messages: Record<number, string> = {
          400: 'El servicio rechazó los datos del perfil. Revisa la información enviada.',
          401: 'El servicio no aceptó tu sesión. Vuelve a iniciar sesión; si persiste, revisa la configuración de acceso.',
          403: 'No tienes permiso para consultar este recurso.',
          404: 'No se encontró el perfil o el endpoint solicitado. Reintenta la sincronización.',
        };
        throw new ApiError(response.status, messages[response.status] || `El servicio de perfiles respondió con un error (${response.status}).`);
      }
      try { return await response.json(); }
      catch { throw new ApiError(response.status, 'El servicio de perfiles no devolvió JSON válido.'); }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new Error(controller.signal.aborted
        ? 'El servicio de perfiles tardó demasiado. Inténtalo de nuevo.'
        : 'No se pudo conectar con el servicio de perfiles. Revisa su disponibilidad y reintenta.');
    } finally { clearTimeout(timeout); }
  }
}
