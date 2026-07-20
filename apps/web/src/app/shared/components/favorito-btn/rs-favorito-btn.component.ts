import { Component, inject, input, OnInit } from '@angular/core';
import { RsIconComponent } from '../icon/rs-icon.component';
import { FavoritosService } from '../../../features/favoritos/favoritos.service';
import { AuthService } from '../../../core/auth/auth.service';

/**
 * Botón ❤️ para marcar/desmarcar un servicio como favorito. Se apoya en el
 * cache de FavoritosService; si el usuario no está autenticado, no se muestra.
 */
@Component({
  selector: 'rs-favorito-btn',
  standalone: true,
  imports: [RsIconComponent],
  template: `
    @if (auth.estaAutenticado()) {
      <button
        type="button"
        class="rs-fav-btn"
        [class.rs-fav-btn--activo]="esFavorito()"
        [attr.aria-pressed]="esFavorito()"
        [attr.aria-label]="esFavorito() ? 'Quitar de favoritos' : 'Añadir a favoritos'"
        (click)="alternar($event)">
        <rs-icon name="heart" [size]="tamano()" [stroke]="2"></rs-icon>
      </button>
    }
  `,
  styles: [`
    .rs-fav-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(255,255,255,.9); border: 1px solid var(--b-1);
      color: var(--t-400); cursor: pointer;
      transition: all var(--d-2);
      &:hover { color: var(--c-red, #E11D48); transform: scale(1.08); }
    }
    .rs-fav-btn--activo { color: var(--c-red, #E11D48); }
    .rs-fav-btn--activo rs-icon { fill: currentColor; }
  `],
})
export class RsFavoritoBtnComponent implements OnInit {
  readonly servicioId = input.required<string>();
  readonly tamano = input(16);

  readonly favoritos = inject(FavoritosService);
  readonly auth = inject(AuthService);

  ngOnInit(): void {
    void this.favoritos.cargarIds();
  }

  esFavorito(): boolean {
    return this.favoritos.esFavorito(this.servicioId());
  }

  async alternar(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    await this.favoritos.toggle(this.servicioId());
  }
}
