import { UnauthorizedException } from '@nestjs/common';
import { JwtOpcionalGuard } from './jwt-opcional.guard';

describe('JwtOpcionalGuard', () => {
  const guard = new JwtOpcionalGuard();

  it('debería devolver el usuario cuando el token es válido', () => {
    const usuario = { sub: 'user-1', rol: 'cliente' };

    expect(guard.handleRequest(null, usuario)).toBe(usuario);
  });

  it('debería devolver undefined en vez de lanzar si no hay token', () => {
    // Es lo que separa este guard del JwtAuthGuard normal: la ruta sigue siendo
    // pública, pero el evento queda atribuido si el visitante sí tiene sesión.
    expect(() => guard.handleRequest(null, false)).not.toThrow();
    expect(guard.handleRequest(null, false)).toBeUndefined();
  });

  it('debería devolver undefined si el token es inválido o ha caducado', () => {
    expect(guard.handleRequest(new UnauthorizedException(), undefined)).toBeUndefined();
  });

  it('debería tratar null como ausencia de usuario', () => {
    expect(guard.handleRequest(null, null)).toBeUndefined();
  });
});
