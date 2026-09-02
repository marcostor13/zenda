import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { FavoritoResumenDto, VerticalKey, VERTICAL_LABELS } from 'shared';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsFavoritoBtnComponent } from '../../shared/components/favorito-btn/rs-favorito-btn.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { FavoritosService } from './favoritos.service';
import { ReservasService } from '../reservas/services/reservas.service';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogBrowseService, type ServicioCard } from '../verticales/catalog-browse.service';

import { EurosPipe } from '../../shared/pipes/euros.pipe';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
import { MonedaService } from '../../core/moneda/moneda.service';
type OrdenFavoritos = 'recientes' | 'valorados' | 'precio';

/** Verticales con ficha de detalle propia (Fase 4); las demás solo tienen listado. */
const VERTICALES_CON_FICHA = new Set<string>([
  VerticalKey.ALOJAMIENTO, VerticalKey.TRANSPORTE, VerticalKey.ADIESTRAMIENTO, VerticalKey.HOTELES,
]);

@Component({
  selector: 'app-favoritos',
  standalone: true,
  imports: [
    TraducirPipe, RouterLink, DecimalPipe, RsNavbarComponent, RsIconComponent, RsFavoritoBtnComponent, ImgFallbackDirective, EurosPipe
  ],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">
    <div class="fav-header">
      <h1><rs-icon name="heart" [size]="24" [stroke]="2"></rs-icon> {{ 'Mis favoritos' | t }}</h1>
      <p>{{ 'Los servicios que has guardado para reservar más rápido.' | t }}</p>
    </div>

    @if (!cargando() && favoritos().length > 0) {
      <div class="fav-toolbar">
        <div class="fav-toolbar__group">
          <label for="fav-filtro">{{ 'Categoría' | t }}</label>
          <select id="fav-filtro" class="rs-input" [value]="filtroVertical()" (change)="filtroVertical.set($any($event.target).value)">
            <option value="">{{ 'Todas' | t }}</option>
            @for (v of verticalesDisponibles(); track v) {
              <option [value]="v">{{ etiquetaVertical(v) }}</option>
            }
          </select>
        </div>
        <div class="fav-toolbar__group">
          <label for="fav-orden">{{ 'Ordenar por' | t }}</label>
          <select id="fav-orden" class="rs-input" [value]="orden()" (change)="orden.set($any($event.target).value)">
            <option value="recientes">{{ 'Más recientes' | t }}</option>
            <option value="valorados">{{ 'Mejor valorados' | t }}</option>
            <option value="precio">{{ 'Precio (menor a mayor)' | t }}</option>
          </select>
        </div>
      </div>
    }

    @if (cargando()) {
      <div style="text-align:center;padding:var(--sp-16);color:var(--t-400)">{{ 'Cargando favoritos…' | t }}</div>
    } @else if (favoritos().length === 0) {
      <div class="rs-card" style="padding:var(--sp-12);text-align:center">
        <rs-icon name="heart" [size]="36" [stroke]="1.25" style="color:var(--t-400);display:block;margin:0 auto var(--sp-4)"></rs-icon>
        <p style="color:var(--t-400);font-size:var(--f-sm);margin-bottom:var(--sp-4)">
          {{ 'Todavía no tienes favoritos. Pulsa el corazón en cualquier servicio para guardarlo aquí.' | t }}
        </p>
        <a routerLink="/" class="rs-btn rs-btn--primary rs-btn--sm">{{ 'Explorar servicios' | t }}</a>
      </div>
    } @else if (favoritosVisibles().length === 0) {
      <div class="rs-card" style="padding:var(--sp-12);text-align:center">
        <p style="color:var(--t-400);font-size:var(--f-sm)">{{ 'Ningún favorito coincide con este filtro.' | t }}</p>
      </div>
    } @else {
      <div class="fav-grid">
        @for (f of favoritosVisibles(); track f.servicioId) {
          <article class="fav-card rs-card">
            <a [routerLink]="['/', f.vertical]" class="fav-card__img">
              @if (f.imagen) {
                <img [src]="f.imagen" [alt]="f.titulo" rsImg />
              } @else {
                <div class="fav-card__placeholder"><rs-icon name="paw" [size]="28" [stroke]="1.5"></rs-icon></div>
              }
              @if (f.precioAnterior) {
                <span class="fav-card__badge"><rs-icon name="flame" [size]="13" [stroke]="2"></rs-icon> Ha bajado {{ f.precioAnterior - f.precioBase | euros:'1.0-0' }} desde que lo guardaste</span>
              }
              @if (yaReservados().has(f.servicioId)) {
                <span class="fav-card__reservado"><rs-icon name="check" [size]="13" [stroke]="3"></rs-icon> {{ 'Ya reservaste aquí' | t }}</span>
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
              <p class="fav-card__desde"><rs-icon name="heart" [size]="12" [stroke]="2"></rs-icon> {{ desdeHace(f.createdAt) }}</p>
              <div class="fav-card__footer">
                <span class="fav-card__rating"><rs-icon name="star" [size]="13" [stroke]="2.5"></rs-icon> {{ f.ratingPromedio | number:'1.1-1' }} · {{ f.totalResenas }} reseñas</span>
                <span class="fav-card__price">{{ f.precioBase | euros:'1.0-0' }}</span>
              </div>
              <div class="fav-card__acciones">
                <a [routerLink]="rutaReservar(f)" class="rs-btn rs-btn--primary rs-btn--block rs-btn--sm">{{ 'Reservar' | t }}</a>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" [title]="'Compartir' | t" (click)="compartir(f)"><rs-icon name="share" [size]="14" [stroke]="2"></rs-icon></button>
              </div>
            </div>
          </article>
        }
      </div>
    }

    <!-- Recomendados a partir de lo que ya tiene guardado (PDF 27/07 §19) -->
    @if (recomendados().length > 0) {
      <section class="fav-reco">
        <h2 class="fav-reco__titulo">
          <rs-icon name="sparkles" [size]="18" [stroke]="2"></rs-icon>
          {{ 'Recomendados para ti' | t }}
        </h2>
        <p class="fav-reco__sub">{{ 'Más opciones parecidas a las que sueles guardar.' | t }}</p>

        <div class="fav-grid">
          @for (s of recomendados(); track s.id) {
            <article class="rs-card fav-card">
              <a class="fav-card__img" [routerLink]="['/', s.vertical, s.id]">
                @if (s.imagenes[0]) {
                  <img [src]="s.imagenes[0]" [alt]="s.nombre" rsImg />
                } @else {
                  <span class="fav-card__placeholder"><rs-icon name="paw" [size]="32" [stroke]="1.5"></rs-icon></span>
                }
                <span class="fav-card__fav" (click)="$event.stopPropagation()">
                  <rs-favorito-btn [servicioId]="s.id"></rs-favorito-btn>
                </span>
              </a>
              <div class="fav-card__body">
                <h3>{{ s.nombre }}</h3>
                <span class="fav-card__loc">
                  <rs-icon name="map-pin" [size]="12" [stroke]="2"></rs-icon> {{ s.ciudad }}
                </span>
                <div class="fav-card__footer">
                  <span class="fav-card__rating">{{ s.score | number:'1.1-1' }} ({{ s.numResenas }})</span>
                  <span class="fav-card__price">{{ s.precioPorNoche | euros }}</span>
                </div>
              </div>
            </article>
          }
        </div>
      </section>
    }
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }
    .fav-header { margin-bottom: var(--sp-6); h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); } p { color: var(--t-400); font-size: var(--f-sm); } }
    .fav-toolbar { display: flex; gap: var(--sp-5); flex-wrap: wrap; margin-bottom: var(--sp-6); }
    .fav-toolbar__group { display: flex; flex-direction: column; gap: var(--sp-1); label { font-size: var(--f-xs); color: var(--t-400); } }
    .fav-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--sp-5); }
    .fav-card { padding: 0; overflow: hidden; display: flex; flex-direction: column; }
    .fav-card__img { position: relative; display: block; aspect-ratio: 16/10; background: var(--c-raised); img { width: 100%; height: 100%; object-fit: cover; } }
    .fav-card__placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 40px; }
    .fav-card__fav { position: absolute; top: var(--sp-3); right: var(--sp-3); }
    .fav-card__badge { position: absolute; left: var(--sp-3); bottom: var(--sp-3); right: var(--sp-3); background: var(--c-amber); color: var(--t-900); font-size: var(--f-xs); font-weight: var(--w-7); padding: var(--sp-1) var(--sp-2); border-radius: var(--r-sm); }
    .fav-card__reservado { position: absolute; left: var(--sp-3); top: var(--sp-3); background: var(--c-success, #16A34A); color: #fff; font-size: var(--f-xs); font-weight: var(--w-7); padding: var(--sp-1) var(--sp-2); border-radius: var(--r-sm); }
    .fav-card__acciones { display: flex; gap: var(--sp-2); }
    .fav-card__body { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); h3 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); } }
    .fav-card__loc { display: inline-flex; align-items: center; gap: 4px; font-size: var(--f-xs); color: var(--t-400); }
    .fav-card__desde { font-size: var(--f-xs); color: var(--t-400); }
    .fav-card__footer { display: flex; justify-content: space-between; align-items: center; margin-block: var(--sp-1); }
    .fav-card__rating { font-size: var(--f-xs); color: var(--t-400); }
    .fav-card__price { font-size: var(--f-md); font-weight: var(--w-8); color: var(--c-accent); }

    /* Recomendados para ti (PDF §19) */
    .fav-reco { margin-top: var(--sp-10); padding-top: var(--sp-8); border-top: 1px solid var(--b-1); }
    .fav-reco__titulo {
      display: flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-lg); font-weight: var(--w-8); color: var(--t-100);
      rs-icon { color: var(--dk-gold); }
    }
    .fav-reco__sub { color: var(--t-400); font-size: var(--f-sm); margin: var(--sp-1) 0 var(--sp-5); }
  `],
})

export class FavoritosComponent implements OnInit {
  /**
   * Divisa de visualización. Se lee para formatear los precios que van dentro
   * de un texto («50 € × 3 noches», los chips de filtro) y que por eso no
   * pueden pasar por el pipe: al leer la señal, la vista se refresca sola en
   * cuanto el usuario cambia de divisa en la cabecera.
   */
  readonly moneda = inject(MonedaService);

  private readonly favoritosService = inject(FavoritosService);
  private readonly reservasService = inject(ReservasService);
  private readonly auth = inject(AuthService);
  private readonly catalogBrowse = inject(CatalogBrowseService);

  readonly cargando = signal(true);
  readonly favoritos = signal<FavoritoResumenDto[]>([]);
  readonly orden = signal<OrdenFavoritos>('recientes');
  readonly filtroVertical = signal<VerticalKey | ''>('');
  /** HU-10.4: servicios que el usuario ya reservó, para el sello "Ya reservaste aquí". */
  readonly yaReservados = signal<Set<string>>(new Set());
  /** "Recomendados para ti" a partir de lo que ya tiene guardado (PDF §19). */
  readonly recomendados = signal<ServicioCard[]>([]);

  readonly verticalesDisponibles = computed(() => {
    const vistos = new Set(this.favoritos().map((f) => f.vertical));
    return Array.from(vistos);
  });

  readonly favoritosVisibles = computed(() => {
    const filtro = this.filtroVertical();
    const lista = filtro ? this.favoritos().filter((f) => f.vertical === filtro) : this.favoritos();
    return [...lista].sort((a, b) => this.comparar(a, b));
  });

  async ngOnInit(): Promise<void> {
    await this.favoritosService.cargarIds();
    try {
      this.favoritos.set(await this.favoritosService.listar());
    } catch {
      // API no disponible
    } finally {
      this.cargando.set(false);
    }

    if (this.auth.usuario()) {
      try {
        const reservas = await this.reservasService.misReservas();
        this.yaReservados.set(new Set(reservas.map((r) => r.servicioId)));
      } catch {
        // Sin datos de reservas no se muestra el sello, pero la página sigue funcionando.
      }
    }

    await this.cargarRecomendados();
  }

  /**
   * "Recomendados para ti" (PDF 27/07 §19): más servicios de la categoría que
   * el usuario más guarda, en la ciudad donde más guarda. Si todavía no tiene
   * favoritos no hay nada en lo que basarse y la sección no se pinta — no se
   * rellena con resultados al azar.
   */
  async cargarRecomendados(): Promise<void> {
    const guardados = this.favoritos();
    if (guardados.length === 0) return;

    const vertical = this.masFrecuente(guardados.map((f) => f.vertical));
    const ciudad = this.masFrecuente(guardados.filter((f) => f.ciudad).map((f) => f.ciudad));
    if (!vertical) return;

    try {
      const encontrados = await this.catalogBrowse.buscar(vertical, { ciudad, orden: 'valoracion' });
      const yaGuardados = new Set(guardados.map((f) => f.servicioId));
      this.recomendados.set(encontrados.filter((s) => !yaGuardados.has(s.id)).slice(0, 4));
    } catch {
      // Sin recomendaciones la página sigue siendo útil: es una sección extra.
    }
  }

  /** Valor que más se repite en una lista; `undefined` si la lista está vacía. */
  private masFrecuente<T extends string>(valores: T[]): T | undefined {
    const conteo = new Map<T, number>();
    valores.forEach((v) => conteo.set(v, (conteo.get(v) ?? 0) + 1));
    return [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  }

  etiquetaVertical(v: VerticalKey): string {
    return VERTICAL_LABELS[v] ?? v;
  }

  /** HU-10.2: "Reservar" lleva a la ficha si existe, si no al listado del vertical. */
  rutaReservar(f: FavoritoResumenDto): string[] {
    if (VERTICALES_CON_FICHA.has(f.vertical) && f.servicioId) {
      return ['/', f.vertical, f.servicioId];
    }
    return ['/', f.vertical];
  }

  async compartir(f: FavoritoResumenDto): Promise<void> {
    const texto = `Mira ${f.titulo} en Doogking: ${this.moneda.formatear(f.precioBase)} · ${f.ciudad || ''}`.trim();
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: 'Doogking', text: texto });
        return;
      } catch {
        // El usuario canceló el share nativo: caemos al portapapeles.
      }
    }
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Sin acceso al portapapeles (permiso denegado): no hay más que ofrecer.
    }
  }

  /** HU-10.2: etiqueta temporal ("Favorito desde hace 3 meses" / "Añadido ayer"). */
  desdeHace(fechaISO: string): string {
    const dias = Math.floor((Date.now() - new Date(fechaISO).getTime()) / 86_400_000);
    if (dias <= 0) return 'Añadido hoy';
    if (dias === 1) return 'Añadido ayer';
    if (dias < 30) return `Favorito desde hace ${dias} días`;
    const meses = Math.floor(dias / 30);
    if (meses < 12) return `Favorito desde hace ${meses} mes${meses > 1 ? 'es' : ''}`;
    const anios = Math.floor(meses / 12);
    return `Favorito desde hace ${anios} año${anios > 1 ? 's' : ''}`;
  }

  /** Al quitar un favorito desde el corazón, lo retiramos también de la lista visible. */
  marcarPendiente(servicioId: string): void {
    setTimeout(() => {
      if (!this.favoritosService.esFavorito(servicioId)) {
        this.favoritos.update((list) => list.filter((f) => f.servicioId !== servicioId));
      }
    }, 250);
  }

  private comparar(a: FavoritoResumenDto, b: FavoritoResumenDto): number {
    switch (this.orden()) {
      case 'valorados':
        return b.ratingPromedio - a.ratingPromedio;
      case 'precio':
        return a.precioBase - b.precioBase;
      case 'recientes':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  }
}
