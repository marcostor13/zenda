import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RsFavoritoBtnComponent } from './rs-favorito-btn.component';
import { FavoritosService } from '../../../features/favoritos/favoritos.service';
import { AuthService } from '../../../core/auth/auth.service';

describe('RsFavoritoBtnComponent', () => {
  const autenticado = signal(false);
  let favoritos: { cargarIds: jest.Mock; esFavorito: jest.Mock; toggle: jest.Mock };
  let router: { navigate: jest.Mock; url: string };

  const crear = () => {
    const fixture = TestBed.createComponent(RsFavoritoBtnComponent);
    fixture.componentRef.setInput('servicioId', 'srv-1');
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(async () => {
    favoritos = { cargarIds: jest.fn(), esFavorito: jest.fn().mockReturnValue(false), toggle: jest.fn() };
    router = { navigate: jest.fn().mockResolvedValue(true), url: '/veterinaria' };
    await TestBed.configureTestingModule({
      imports: [RsFavoritoBtnComponent],
      providers: [
        { provide: FavoritosService, useValue: favoritos },
        { provide: AuthService, useValue: { estaAutenticado: autenticado } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
  });

  it('debería mostrar el corazón aunque no haya sesión', () => {
    autenticado.set(false);
    const fixture = crear();
    expect(fixture.nativeElement.querySelector('button.rs-fav-btn')).not.toBeNull();
  });

  it('debería llevar al login y volver a la misma página si no hay sesión', async () => {
    autenticado.set(false);
    const fixture = crear();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], { queryParams: { volverA: '/veterinaria' } });
    expect(favoritos.toggle).not.toHaveBeenCalled();
  });

  it('debería alternar el favorito si hay sesión', async () => {
    autenticado.set(true);
    const fixture = crear();

    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();

    expect(favoritos.toggle).toHaveBeenCalledWith('srv-1');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
