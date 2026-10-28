import { DI, Registration } from 'aurelia';
import { IRouter } from '@aurelia/router';
import { IAuthService } from '../../src/auth/auth-service';
import { MockAuthService } from '../../src/auth/mock-auth-service';
import { IProfileService } from '../../src/profile/profile-service';
import { MockProfileService } from '../../src/profile/mock-profile-service';
import { LoginPage } from '../../src/pages/login/login-page';
import { MyApp } from '../../src/my-app';

describe('acciones de sesion y navegacion', () => {
  function setup() {
    const auth = new MockAuthService();
    const load = jest.fn().mockResolvedValue(true);
    const container = DI.createContainer();
    container.register(Registration.instance(IAuthService, auth), Registration.singleton(IProfileService, MockProfileService), Registration.instance(IRouter, { load }));
    return { auth, load, container };
  }
  it('navega al iniciar, limpia perfil al salir y conserva un error recuperable', async () => {
    const { auth, load, container } = setup();
    const page = container.invoke(LoginPage);
    page.displayName = 'Ana';
    await page.signIn();
    expect(load).toHaveBeenCalledWith('home');
    const reset = jest.spyOn(container.get(IProfileService), 'reset');
    jest.spyOn(auth, 'signOut').mockRejectedValueOnce(new Error('Sin conexion'));
    await page.signOut();
    expect(page.error).toBe('Sin conexion');
    expect(reset).not.toHaveBeenCalled();
    await page.signOut();
    expect(reset).toHaveBeenCalled();
    expect(page.displayName).toBe('');
    expect(page.busy).toBe(false);
    jest.spyOn(auth, 'signIn').mockRejectedValueOnce(new Error('Login no disponible'));
    await page.signIn();
    expect(page.error).toBe('Login no disponible');
    container.dispose();
  });
  it('evita acciones duplicadas mientras se procesa la sesion', async () => {
    const { auth, container } = setup();
    const page = container.invoke(LoginPage);
    const signIn = jest.spyOn(auth, 'signIn');
    const signOut = jest.spyOn(auth, 'signOut');
    page.busy = true;
    await page.signIn();
    await page.signOut();
    expect(signIn).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    container.dispose();
  });
  it('mantiene perfil y menu cuando falla logout y permite reintentar', async () => {
    const { auth, container } = setup();
    await auth.signIn('Ana Perez');
    const app = container.invoke(MyApp);
    expect(app.initials).toBe('AP');
    app.menuOpen = true;
    jest.spyOn(auth, 'signOut').mockRejectedValueOnce(new Error('Sin conexion'));
    await app.signOut();
    expect(app.sessionError).not.toBe('');
    expect(app.menuOpen).toBe(true);
    await app.signOut();
    expect(app.menuOpen).toBe(false);
    expect(app.sessionError).toBe('');
    const sync = jest.spyOn(container.get(IProfileService), 'sync').mockRejectedValue(new Error('Profile caido'));
    await expect(app.retryProfile()).resolves.toBeUndefined();
    expect(sync).toHaveBeenCalled();
    container.dispose();
  });
  it('cierra el menu despues del enlace y evita repetir logout pendiente', async () => {
    jest.useFakeTimers();
    const { auth, container } = setup();
    try {
      const app = container.invoke(MyApp);
      app.menuOpen = true;
      expect(app.closeMenu()).toBe(true);
      expect(app.menuOpen).toBe(true);
      jest.runOnlyPendingTimers();
      expect(app.menuOpen).toBe(false);
      app.signingOut = true;
      const logout = jest.spyOn(auth, 'signOut');
      await app.signOut();
      expect(logout).not.toHaveBeenCalled();
      app.binding();
    } finally { jest.useRealTimers(); container.dispose(); }
  });
});
