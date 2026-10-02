import { MockAuthService } from '../../src/auth/mock-auth-service';

describe('Sesión simulada', () => {
  it('valida el nombre, abre una sesión y la elimina al salir', async () => {
    const auth = new MockAuthService();
    expect(auth.user).toBeNull();
    await expect(auth.signIn('   ')).rejects.toThrow();
    await expect(auth.signIn('a'.repeat(51))).rejects.toThrow();
    expect(auth.user).toBeNull();
    await auth.signIn('  Ana  ');
    expect(auth.user).toEqual({ id: 'demo-user', displayName: 'Ana' });
    await auth.signOut();
    expect(auth.user).toBeNull();
    expect(new MockAuthService().user).toBeNull();
  });
});
