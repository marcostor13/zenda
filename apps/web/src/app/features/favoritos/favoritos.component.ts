import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { FavoritoResumenDto } from 'shared';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsFavoritoBtnComponent } from '../../shared/components/favorito-btn/rs-favorito-btn.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { FavoritosService } from './favoritos.service';

@Component({
  selector: 'app-favoritos',
  standalone: true,
  imports: [RouterLink, DecimalPipe, RsNavbarComponent, RsIconComponent, RsFavoritoBtnComponent, ImgFallbackDirective],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">
    <div class="fav-header">
      <h1>❤️ Mis favoritos</h1>
      <p>Los servicios que has guardado para reservar más rápido.</p>
    </div>

    @if (cargando()) {
      <div style="text-align:center;padding:var(--sp-16);color:var(--t-400)">Cargando favoritos…</div>
    } @else if (favoritos().length === 0) {
      <div class="rs-card" style="padding:var(--sp-12);text-align:center">
        <rs-icon name="heart" [size]="36" [stroke]="1.25" style="color:var(--t-400);display:block;margin:0 auto var(--sp-4)"></rs-icon>
        <p style="color:var(--t-400);font-size:var(--f-sm);margin-bottom:var(--sp-4)">
          Todavía no tienes favoritos. Pulsa el corazón en cualquier servicio para guardarlo aquí.
        </p>
        <a routerLink="/buscador" class="rs-btn rs-btn--primary rs-btn--sm">Explorar servicios</a>
      </div>
    } @else {
      <div class="fav-grid">
        @for (f of favoritos(); track f.servicioId) {
          <article class="fav-card rs-card">
            <a [routerLink]="['/', f.vertical]" class="fav-card__img">
              @if (f.imagen) {
                <img [src]="f.imagen" [alt]="f.titulo" rsImg />
              } @else {
                <div class="fav-card__placeholder">🐾</div>
              }
              <div class="fav-card__fav">
                <rs-favorito-btn [servicioId]="f.servicioId" (click)="marcarPendiente(f.servicioId)"></rs-favorito-btn>
              </div>
            </a>
            <div class="fav-card__body">
              <h3>{{ f.titulo }}</h3>
              <p class="fav-card__loc">
                <rs-icon name="map-pin" [size]="13" [stroke]="2"></rs-icon> {{ f.ciudad || '—' }}
              </p>
              <div class="fav-card__footer">
                <span class="fav-card__rating">⭐ {{ f.ratingPromedio | number:'1.1-1' }} · {{ f.totalResenas }} reseñas</span>
                <span class="fav-card__price">{{ f.precioBase | number:'1.0-0' }} €</span>
              </div>
              <a [routerLink]="['/', f.vertical]" class="rs-btn rs-btn--primary rs-btn--block rs-btn--sm">Ver servicio</a>
            </div>
          </article>
        }
      </div>
    }
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }
    .fav-header { margin-bottom: var(--sp-6); h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); } p { color: var(--t-400); font-size: var(--f-sm); } }
    .fav-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--sp-5); }
    .fav-card { padding: 0; overflow: hidden; display: flex; flex-direction: column; }
    .fav-card__img { position: relative; display: block; aspect-ratio: 16/10; background: var(--c-raised); img { width: 100%; height: 100%; object-fit: cover; } }
    .fav-card__placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 40px; }
    .fav-card__fav { position: absolute; top: var(--sp-3); right: var(--sp-3); }
    .fav-card__body { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); h3 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); } }
    .fav-card__loc { display: inline-flex; align-items: center; gap: 4px; font-size: var(--f-xs); color: var(--t-400); }
    .fav-card__footer { display: flex; justify-content: space-between; align-items: center; margin-block: var(--sp-1); }
    .fav-card__rating { font-size: var(--f-xs); color: var(--t-400); }
    .fav-card__price { font-size: var(--f-md); font-weight: var(--w-8); color: var(--c-accent); }
  `],
})
export class FavoritosComponent implements OnInit {
  private readonly favoritosService = inject(FavoritosService);

  readonly cargando = signal(true);
  readonly favoritos = signal<FavoritoResumenDto[]>([]);

  async ngOnInit(): Promise<void> {
    await this.favoritosService.cargarIds();
    try {
      this.favoritos.set(await this.favoritosService.listar());
    } catch {
      // API no disponible
    } finally {
      this.cargando.set(false);
    }
  }

  /** Al quitar un favorito desde el corazón, lo retiramos también de la lista visible. */
  marcarPendiente(servicioId: string): void {
    setTimeout(() => {
      if (!this.favoritosService.esFavorito(servicioId)) {
        this.favoritos.update((list) => list.filter((f) => f.servicioId !== servicioId));
      }
    }, 250);
  }
}
