import { JwtService } from '@nestjs/jwt';
import { OauthStateService } from './oauth-state.service';
import { DomainException } from '../../shared/exceptions/domain.exception';

describe('OauthStateService', () => {
  let service: OauthStateService;
  let jwtService: JwtService;

  const SECRETO = 'secreto-de-pruebas';

  beforeEach(() => {
    jwtService = new JwtService({ secret: SECRETO });
    service = new OauthStateService(jwtService);
  });

  it('debería devolver el mismo estado que se firmó', () => {
    const state = service.firmar({ agendaId: 'agenda-1', comercioId: 'comercio-1' });

    expect(service.verificar(state)).toEqual({ agendaId: 'agenda-1', comercioId: 'comercio-1' });
  });

  it('debería rechazar un state fabricado a mano', () => {
    // Así era el formato anterior: base64url de un JSON, sin firma alguna.
    const falsificado = Buffer
      .from(JSON.stringify({ agendaId: 'agenda-ajena', comercioId: 'comercio-ajeno' }))
      .toString('base64url');

    expect(() => service.verificar(falsificado)).toThrow(DomainException);
  });

  it('debería rechazar un state firmado con otro secreto', () => {
    const otro = new JwtService({ secret: 'otro-secreto' });
    const state = new OauthStateService(otro).firmar({ agendaId: 'a', comercioId: 'c' });

    expect(() => service.verificar(state)).toThrow(DomainException);
  });

  it('debería rechazar un token de sesión aunque esté firmado con el mismo secreto', () => {
    // Sin la audiencia, un accessToken válido serviría de state y viceversa.
    const tokenDeSesion = jwtService.sign({ sub: 'user-1', rol: 'admin' });

    expect(() => service.verificar(tokenDeSesion)).toThrow(DomainException);
  });

  it('debería rechazar un state caducado', () => {
    const caducado = jwtService.sign(
      { agendaId: 'a', comercioId: 'c' },
      { audience: 'agenda-oauth', expiresIn: '-1s' },
    );

    expect(() => service.verificar(caducado)).toThrow(DomainException);
  });

  it('debería rechazar un state válido pero sin comercio', () => {
    const incompleto = jwtService.sign(
      { agendaId: 'a' },
      { audience: 'agenda-oauth', expiresIn: '10m' },
    );

    expect(() => service.verificar(incompleto)).toThrow(DomainException);
  });

  it('debería caducar el state en 10 minutos', () => {
    const state = service.firmar({ agendaId: 'a', comercioId: 'c' });
    const { exp, iat } = jwtService.decode(state) as { exp: number; iat: number };

    expect(exp - iat).toBe(600);
  });
});
