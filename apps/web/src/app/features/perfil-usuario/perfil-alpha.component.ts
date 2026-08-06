import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { IMG_FALLBACK } from '../../shared/media/images';
import { enlaceAServicio } from '../../shared/verticales/verticales.config';
import { AlphaService, AlphaEstadoApi, AlphaNivelApi, AlphaVentajaApi } from '../alpha/alpha.service';

@Component({
  selector: 'app-perfil-alpha',
  standalone: true,
  imports: [RouterLink, DecimalPipe, RsNavbarComponent, RsIconComponent, ImgFallbackDirective],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">

    <a routerLink="/perfil" class="back-link">
      <rs-icon name="arrow-left" [size]="14" [stroke]="2"></rs-icon>
      Volver al perfil
    </a>

    <div class="page-header">
      <h1>👑 Ventajas Doogking Alpha</h1>
      <p>Cuantas más reservas completes, más ventajas desbloqueas. Así funciona la escalera.</p>
    </div>

    @if (cargando()) {
      <div class="rs-card" style="padding:var(--sp-8);text-align:center">
        <div class="spinner"></div>
      </div>
    } @else {
      <div class="niveles-list">
        @for (n of niveles(); track n.nivel) {
          <div class="rs-card nivel-card" [class.nivel-card--activo]="esNivelActual(n.nivel)">
            <div class="nivel-card__head">
              <span class="nivel-card__nombre">{{ n.nombre }}</span>
              @if (esNivelActual(n.nivel)) {
                <span class="rs-badge rs-badge--accent">Tu nivel actual</span>
              }
            </div>
            <p class="nivel-card__requisito">
              @if (n.reservasRequeridas === 0) {
                Desde que te registras
              } @else {
                Desde {{ n.reservasRequeridas }} reservas completadas
              }
              @if (n.descuentoPct > 0) {
                · hasta {{ n.descuentoPct | number:'1.0-0':'es' }}% de descuento
              }
            </p>
            @if (n.beneficios.length > 0) {
              <ul class="nivel-card__beneficios">
                @for (b of n.beneficios; track b) {
                  <li>✔ {{ b }}</li>
                }
              </ul>
            }
          </div>
        }
      </div>

      <!-- Ventajas disponibles para ti (HU-13.3) -->
      @if (adheridos().length > 0) {
        <section class="ventajas">
          <h2>Ventajas disponibles para ti</h2>
          <p class="ventajas__sub">
            Estos negocios están adheridos al programa Alpha.
            @if (descuentoActual() > 0) {
              Con tu nivel tienes hasta un {{ descuentoActual() | number:'1.0-0':'es' }}% de descuento.
            }
          </p>
          <div class="ventajas__carrusel">
            @for (s of adheridos(); track s.id) {
              <a [routerLink]="enlaceAServicio(s.vertical, s.id)" class="ventaja-card">
                <img [src]="s.imagenes[0] || fallbackImg" [alt]="s.nombre" rsImg />
                <div class="ventaja-card__info">
                  <span class="rs-badge rs-badge--accent">🏆 Ventajas Alpha</span>
                  <strong>{{ s.nombre }}</strong>
                  <span class="ventaja-card__meta">📍 {{ s.ciudad }}</span>
                </div>
              </a>
            }
          </div>
        </section>
      }
    }

  </div>
</div>
  `,
  styles: [`
    :host { display: block; }

    .back-link {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); color: var(--t-400); text-decoration: none;
      margin-bottom: var(--sp-6); transition: color var(--d-2);
      &:hover { color: var(--c-accent); }
    }

    .page-header {
      margin-bottom: var(--sp-8);
      h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-2); }
      p { color: var(--t-400); font-size: var(--f-sm); }
    }

    .niveles-list { display: flex; flex-direction: column; gap: var(--sp-4); max-width: 640px; }
    .nivel-card { padding: var(--sp-5); border: 2px solid transparent; }
    .nivel-card--activo { border-color: var(--dk-gold, var(--c-amber, #FBAE17)); }
    .nivel-card__head { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-2); }
    .nivel-card__nombre { font-size: var(--f-lg); font-weight: var(--w-8); color: var(--t-100); }
    .nivel-card__requisito { font-size: var(--f-sm); color: var(--t-400); margin-bottom: var(--sp-3); }
    .nivel-card__beneficios { list-style: none; display: flex; flex-direction: column; gap: var(--sp-1); li { font-size: var(--f-sm); color: var(--t-300); } }

    /* Carrusel de ventajas Alpha (HU-13.3) */
    .ventajas { margin-top: var(--sp-10); }
    .ventajas h2 { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-2); }
    .ventajas__sub { font-size: var(--f-sm); color: var(--t-400); margin-bottom: var(--sp-5); }
    .ventajas__carrusel {
      display: flex; gap: var(--sp-4); overflow-x: auto; padding-bottom: var(--sp-3);
      scroll-snap-type: x mandatory;
    }
    .ventaja-card {
      flex: 0 0 240px; scroll-snap-align: start; text-decoration: none;
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-lg);
      overflow: hidden; transition: transform var(--d-2), box-shadow var(--d-2);
      &:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); }
      img { width: 100%; height: 132px; object-fit: cover; display: block; }
    }
    .ventaja-card__info {
      padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); align-items: flex-start;
      strong { font-size: var(--f-sm); color: var(--t-100); }
    }
    .ventaja-card__meta { font-size: var(--f-xs); color: var(--t-400); }

    .spinner {
      width: 32px; height: 32px; border-radius: 50%;
      border: 3px solid var(--b-2); border-top-color: var(--c-accent);
      animation: spin .8s linear infinite; margin: 0 auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class PerfilAlphaComponent implements OnInit {
  private readonly alphaService = inject(AlphaService);

  readonly cargando = signal(true);
  readonly niveles = signal<AlphaNivelApi[]>([]);
  readonly miEstado = signal<AlphaEstadoApi | null>(null);

  // Carrusel "Ventajas disponibles para ti" (HU-13.3)
  readonly adheridos = signal<AlphaVentajaApi[]>([]);
  readonly fallbackImg = IMG_FALLBACK;
  readonly enlaceAServicio = enlaceAServicio;

  /** Descuento del nivel actual; 0 si el usuario no tiene sesión o estado Alpha. */
  readonly descuentoActual = computed(() => this.miEstado()?.descuentoPct ?? 0);

  async ngOnInit(): Promise<void> {
    try {
      const [niveles, miEstado, ventajas] = await Promise.all([
        this.alphaService.niveles(),
        this.alphaService.miEstado().catch(() => null),
        // Sin sesión o sin adheridos el carrusel simplemente no se pinta.
        this.alphaService.ventajas().catch(() => [] as AlphaVentajaApi[]),
      ]);
      this.niveles.set(niveles);
      this.miEstado.set(miEstado);
      this.adheridos.set(ventajas);
    } catch {
      // API no disponible
    } finally {
      this.cargando.set(false);
    }
  }

  esNivelActual(nivel: number): boolean {
    return this.miEstado()?.nivelActual === nivel;
  }
}
