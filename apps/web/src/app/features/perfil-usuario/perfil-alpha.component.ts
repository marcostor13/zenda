import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { nombreAlphaPresentacion } from 'shared';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { IMG_FALLBACK } from '../../shared/media/images';
import { enlaceAServicio, verticalUi } from '../../shared/verticales/verticales.config';
import { AlphaService, AlphaEstadoApi, AlphaNivelApi, AlphaVentajaApi } from '../alpha/alpha.service';

import { euros } from '../../shared/pipes/euros.pipe';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
/** Un escalón del club, ya resuelto para pintar (nombre romano, insignia, estado). */
interface NivelVista {
  readonly nivel: number;
  readonly nombre: string;
  readonly romano: string;
  readonly requisito: string;
  readonly descuentoPct: number;
  readonly beneficios: readonly BeneficioVista[];
  readonly esActual: boolean;
  readonly esSiguiente: boolean;
  readonly desbloqueado: boolean;
}

interface BeneficioVista {
  readonly icono: string;
  readonly texto: string;
}

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * Empareja cada beneficio con un icono de la misma familia Lucide que el resto
 * de la plataforma (TCK-8011: nada de emojis). Se decide por el texto porque los
 * beneficios los edita el admin como texto libre desde el panel (HU-13.4).
 */
function iconoDeBeneficio(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes('descuento') || t.includes('ahorra') || t.includes('%')) return 'percent';
  if (t.includes('prioridad') || t.includes('antes que')) return 'zap';
  if (t.includes('promocion') || t.includes('oferta')) return 'tag';
  if (t.includes('premium') || t.includes('exclusiv')) return 'sparkles';
  if (t.includes('regalo') || t.includes('sorteo')) return 'gift';
  return 'check';
}

@Component({
  selector: 'app-perfil-alpha',
  standalone: true,
  imports: [
    TraducirPipe, RouterLink, DecimalPipe, RsNavbarComponent, RsIconComponent, ImgFallbackDirective
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="alpha-page">
  <rs-navbar />

  <div class="rs-wrap alpha-page__wrap">

    <a routerLink="/perfil" class="back-link">
      <rs-icon name="arrow-left" [size]="14" [stroke]="2" />
      {{ 'Volver al perfil' | t }}
    </a>

    <header class="page-header">
      <span class="page-header__eyebrow">
        <rs-icon name="crown" [size]="14" [stroke]="2" /> {{ 'Club exclusivo' | t }}
      </span>
      <h1>{{ 'Programa Doogking Alpha' | t }}</h1>
      <p>{{ 'Cuantas más reservas completes, más ventajas exclusivas desbloquearás.' | t }}</p>
    </header>

    @if (cargando()) {
      <div class="rs-card" style="padding:var(--sp-8);text-align:center">
        <div class="spinner"></div>
      </div>
    } @else {

      <!-- Tarjeta destacada del nivel actual + progreso -->
      @if (estado(); as e) {
        <section class="estado-card" aria-labelledby="alpha-estado-titulo">
          <div class="estado-card__top">
            <span class="insignia insignia--actual" aria-hidden="true">
              <rs-icon name="crown" [size]="22" [stroke]="2" />
              <span class="insignia__romano">{{ romanoActual() }}</span>
            </span>
            <div class="estado-card__texto">
              <span class="estado-card__label">{{ 'Tu nivel actual' | t }}</span>
              <h2 class="estado-card__nivel" id="alpha-estado-titulo">{{ nombreActual() }}</h2>
            </div>
            @if (e.descuentoPct > 0) {
              <span class="estado-card__descuento">
                −{{ e.descuentoPct * 100 | number:'1.0-0':'es' }}%
              </span>
            }
          </div>

          <!-- Condiciones del descuento tal y como las configura el admin
               (TCK-8030 §10): un "−10 %" sin tope ni categorías se lee como
               si valiera para todo y sin límite. -->
          @if (condicionesDescuento().length) {
            <ul class="condiciones">
              @for (c of condicionesDescuento(); track c) {
                <li><rs-icon name="alert-circle" [size]="13" [stroke]="2" /> {{ c }}</li>
              }
            </ul>
          }

          <div class="progreso">
            <div class="progreso__barra">
              <div class="progreso__fill" [style.width.%]="progresoPct()"></div>
            </div>
            <p class="progreso__mensaje">
              @if (e.esMaximoNivel) {
                <rs-icon name="trophy" [size]="15" [stroke]="2" />
                Has llegado al nivel máximo del club. Disfruta de todas las ventajas Alpha.
              } @else {
                <rs-icon name="trending-up" [size]="15" [stroke]="2" />
                Solo te {{ e.reservasParaSiguiente === 1 ? 'falta' : 'faltan' }}
                {{ e.reservasParaSiguiente }}
                {{ e.reservasParaSiguiente === 1 ? 'reserva' : 'reservas' }}
                para llegar a {{ nombreSiguiente() }}.
              }
            </p>
            <p class="progreso__detalle">
              {{ e.reservasCompletadas }}
              {{ e.reservasCompletadas === 1 ? 'reserva completada' : 'reservas completadas' }}
            </p>
          </div>

          <!-- Lo que gana el usuario si sigue reservando (TCK-8011) -->
          @if (beneficiosSiguiente().length) {
            <div class="siguiente">
              <h3 class="siguiente__titulo">
                Al llegar a {{ nombreSiguiente() }} desbloqueas
              </h3>
              <ul class="siguiente__lista">
                @for (b of beneficiosSiguiente(); track b.texto) {
                  <li>
                    <rs-icon [name]="b.icono" [size]="15" [stroke]="2" />
                    {{ b.texto }}
                  </li>
                }
              </ul>
            </div>
          }
        </section>
      }

      <!-- La escalera completa, un nivel por tarjeta -->
      <h2 class="seccion-titulo">{{ 'La escalera Alpha' | t }}</h2>
      <div class="niveles-grid">
        @for (n of nivelesVista(); track n.nivel) {
          <article
            class="nivel-card"
            [class.nivel-card--actual]="n.esActual"
            [class.nivel-card--bloqueado]="!n.desbloqueado">
            <div class="nivel-card__head">
              <span class="insignia" [class.insignia--on]="n.desbloqueado" aria-hidden="true">
                <rs-icon name="crown" [size]="18" [stroke]="2" />
                <span class="insignia__romano">{{ n.romano }}</span>
              </span>
              <div>
                <h3 class="nivel-card__nombre">{{ n.nombre }}</h3>
                <p class="nivel-card__requisito">{{ n.requisito }}</p>
              </div>
            </div>

            @if (n.esActual) {
              <span class="rs-badge rs-badge--accent nivel-card__chip">{{ 'Tu nivel actual' | t }}</span>
            } @else if (n.esSiguiente) {
              <span class="rs-badge rs-badge--warning nivel-card__chip">{{ 'Siguiente nivel' | t }}</span>
            }

            @if (n.descuentoPct > 0) {
              <p class="nivel-card__descuento">
                <rs-icon name="percent" [size]="15" [stroke]="2" />
                Ahorra hasta un {{ n.descuentoPct * 100 | number:'1.0-0':'es' }}% en tus reservas
              </p>
            }

            @if (n.beneficios.length) {
              <ul class="nivel-card__beneficios">
                @for (b of n.beneficios; track b.texto) {
                  <li>
                    <rs-icon [name]="b.icono" [size]="15" [stroke]="2" />
                    {{ b.texto }}
                  </li>
                }
              </ul>
            }
          </article>
        }
      </div>

      <!-- Ventajas disponibles para ti (HU-13.3) -->
      @if (adheridos().length > 0) {
        <section class="ventajas">
          <h2 class="seccion-titulo">{{ 'Ventajas disponibles para ti' | t }}</h2>
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
                  <span class="rs-badge rs-badge--accent">
                    <rs-icon name="crown" [size]="12" [stroke]="2" /> {{ 'Ventajas Alpha' | t }}
                  </span>
                  <strong>{{ s.nombre }}</strong>
                  <span class="ventaja-card__meta">
                    <rs-icon name="map-pin" [size]="12" [stroke]="2" /> {{ s.ciudad }}
                  </span>
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

    .alpha-page { min-height: 100vh; background: var(--c-base); }
    .alpha-page__wrap { padding-block: var(--sp-10); }

    .back-link {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); color: var(--t-400); text-decoration: none;
      margin-bottom: var(--sp-6); transition: color var(--d-2);
      &:hover { color: var(--c-accent); }
    }

    /* ── Cabecera ─────────────────────────────────────────────────── */
    .page-header {
      margin-bottom: var(--sp-8);

      h1 {
        font-family: var(--font-display);
        font-size: var(--f-2xl); font-weight: var(--w-8);
        color: var(--t-100); margin-bottom: var(--sp-2);
      }
      p { color: var(--t-400); font-size: var(--f-md); max-width: 52ch; }
    }

    .page-header__eyebrow {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      font-family: var(--font-accent);
      font-size: var(--f-xs); font-weight: var(--w-7);
      text-transform: uppercase; letter-spacing: .1em;
      color: var(--dk-gold-text, #B45309);
      margin-bottom: var(--sp-3);
    }

    /* ── Insignia de nivel ────────────────────────────────────────── */
    .insignia {
      position: relative;
      display: inline-flex; align-items: center; justify-content: center;
      width: 48px; height: 48px; flex: 0 0 auto;
      border-radius: var(--r-full);
      background: var(--b-1, rgba(0,0,0,.06));
      color: var(--t-400);
      transition: background var(--d-2), color var(--d-2);
    }

    .insignia--on { background: var(--g-warm); color: var(--dk-blue-deep); }
    .insignia--actual {
      width: 56px; height: 56px;
      background: rgba(255,255,255,.18);
      color: #fff;
      border: 2px solid var(--dk-gold);
    }

    /* El número romano cuelga de la corona como una chapa de mérito. */
    .insignia__romano {
      position: absolute; bottom: -4px; right: -4px;
      min-width: 20px; padding: 0 4px;
      font-family: var(--font-accent);
      font-size: 10px; font-weight: var(--w-8); line-height: 16px;
      text-align: center; letter-spacing: .04em;
      color: var(--dk-blue-deep);
      background: var(--dk-gold);
      border-radius: var(--r-full);
    }

    /* ── Tarjeta de estado ────────────────────────────────────────── */
    .estado-card {
      background: var(--g-accent, var(--dk-blue));
      color: #fff;
      border-radius: 16px;
      padding: var(--sp-6);
      margin-bottom: var(--sp-10);
      box-shadow: var(--sh-2, 0 10px 30px rgba(8,37,139,.18));
    }

    .estado-card__top {
      display: flex; align-items: center; gap: var(--sp-4);
      flex-wrap: wrap; margin-bottom: var(--sp-6);
    }

    .estado-card__texto { display: flex; flex-direction: column; gap: 2px; }

    .estado-card__label {
      font-family: var(--font-accent);
      font-size: var(--f-xs); font-weight: var(--w-7);
      text-transform: uppercase; letter-spacing: .1em;
      color: rgba(255,255,255,.75);
    }

    .estado-card__nivel {
      font-family: var(--font-accent);
      font-size: var(--f-xl); font-weight: var(--w-8);
      letter-spacing: .04em; color: #fff;
    }

    .estado-card__descuento {
      margin-left: auto;
      font-family: var(--font-accent);
      font-size: var(--f-xl); font-weight: var(--w-8);
      color: var(--dk-gold);
    }

    .condiciones {
      list-style: none; margin: 0 0 var(--sp-4); padding: 0;
      display: flex; flex-wrap: wrap; gap: var(--sp-2) var(--sp-5);
    }
    .condiciones li {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); color: rgba(255,255,255,.82);
    }

    .progreso__barra {
      height: 10px; border-radius: var(--r-full); overflow: hidden;
      background: rgba(255,255,255,.22); margin-bottom: var(--sp-3);
    }

    .progreso__fill {
      height: 100%; border-radius: var(--r-full);
      background: var(--g-warm, var(--dk-gold));
      transition: width .5s ease;
    }

    .progreso__mensaje {
      display: flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-base); font-weight: var(--w-6); color: #fff;
    }

    .progreso__detalle {
      margin-top: var(--sp-1);
      font-size: var(--f-xs); color: rgba(255,255,255,.72);
    }

    .siguiente {
      margin-top: var(--sp-6);
      padding-top: var(--sp-5);
      border-top: 1px solid rgba(255,255,255,.18);
    }

    .siguiente__titulo {
      font-size: var(--f-sm); font-weight: var(--w-7);
      color: var(--dk-gold); margin-bottom: var(--sp-3);
    }

    .siguiente__lista {
      list-style: none; margin: 0; padding: 0;
      display: flex; flex-direction: column; gap: var(--sp-2);

      li {
        display: flex; align-items: flex-start; gap: var(--sp-2);
        font-size: var(--f-sm); color: rgba(255,255,255,.92);
        rs-icon { flex: 0 0 auto; margin-top: 2px; color: var(--dk-gold); }
      }
    }

    /* ── Escalera ─────────────────────────────────────────────────── */
    .seccion-titulo {
      font-family: var(--font-accent);
      font-size: var(--f-xs); font-weight: var(--w-7);
      text-transform: uppercase; letter-spacing: .1em;
      color: var(--t-400); margin-bottom: var(--sp-4);
    }

    .niveles-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: var(--sp-4);
      align-items: start;
    }

    .nivel-card {
      background: var(--c-card);
      border: 2px solid var(--b-1, rgba(0,0,0,.08));
      border-radius: 16px;
      padding: var(--sp-5);
      transition: border-color var(--d-2), transform var(--d-2);
    }

    .nivel-card--actual {
      border-color: var(--dk-gold);
      box-shadow: 0 0 0 4px rgba(251,174,23,.14);
    }

    /* Un nivel aún no alcanzado se atenúa, pero se sigue leyendo: es el
       incentivo, no un estado deshabilitado. */
    .nivel-card--bloqueado { opacity: .78; }

    .nivel-card__head {
      display: flex; align-items: center; gap: var(--sp-3);
      margin-bottom: var(--sp-3);
    }

    .nivel-card__nombre {
      font-family: var(--font-accent);
      font-size: var(--f-lg); font-weight: var(--w-8);
      letter-spacing: .04em; color: var(--t-100);
    }

    .nivel-card__requisito { font-size: var(--f-xs); color: var(--t-400); }

    .nivel-card__chip { margin-bottom: var(--sp-3); }

    .nivel-card__descuento {
      display: flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); font-weight: var(--w-7);
      color: var(--c-accent); margin-bottom: var(--sp-3);
    }

    .nivel-card__beneficios {
      list-style: none; margin: 0; padding: 0;
      display: flex; flex-direction: column; gap: var(--sp-2);

      li {
        display: flex; align-items: flex-start; gap: var(--sp-2);
        font-size: var(--f-sm); line-height: 1.45; color: var(--t-300);
        rs-icon { flex: 0 0 auto; margin-top: 2px; color: var(--c-accent); }
      }
    }

    /* Carrusel de ventajas Alpha (HU-13.3) */
    .ventajas { margin-top: var(--sp-10); }
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
      .rs-badge { display: inline-flex; align-items: center; gap: 4px; }
    }
    .ventaja-card__meta {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: var(--f-xs); color: var(--t-400);
    }

    .spinner {
      width: 32px; height: 32px; border-radius: 50%;
      border: 3px solid var(--b-2); border-top-color: var(--c-accent);
      animation: spin .8s linear infinite; margin: 0 auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 640px) {
      .estado-card__descuento { margin-left: 0; }
    }
  `],
})
export class PerfilAlphaComponent implements OnInit {
  private readonly alphaService = inject(AlphaService);

  readonly cargando = signal(true);
  readonly niveles = signal<AlphaNivelApi[]>([]);
  readonly estado = signal<AlphaEstadoApi | null>(null);

  readonly nombreActual = computed(() => {
    const e = this.estado();
    return e ? nombreAlphaPresentacion(e.nombreNivel, e.nivelActual) : '';
  });

  readonly romanoActual = computed(() => ROMANOS[(this.estado()?.nivelActual ?? 1) - 1] ?? '');

  readonly nombreSiguiente = computed(() => {
    const s = this.estado()?.siguienteNivel;
    return s ? nombreAlphaPresentacion(s.nombre, s.nivel) : '';
  });

  readonly beneficiosSiguiente = computed<BeneficioVista[]>(() =>
    (this.estado()?.siguienteNivel?.beneficios ?? []).map((texto) => ({
      icono: iconoDeBeneficio(texto),
      texto,
    })),
  );

  /** Avance hacia el siguiente escalón, en % — 100 si ya está en el máximo. */
  readonly progresoPct = computed(() => {
    const e = this.estado();
    if (!e) return 0;
    if (e.esMaximoNivel || !e.siguienteNivel) return 100;

    const nivelActual = this.niveles().find((n) => n.nivel === e.nivelActual);
    const desde = nivelActual?.reservasRequeridas ?? 0;
    const hasta = e.siguienteNivel.reservasRequeridas;
    const tramo = hasta - desde;
    if (tramo <= 0) return 100;

    const avance = ((e.reservasCompletadas - desde) / tramo) * 100;
    return Math.min(100, Math.max(0, Math.round(avance)));
  });

  readonly nivelesVista = computed<NivelVista[]>(() => {
    const e = this.estado();
    return this.niveles().map((n) => ({
      nivel: n.nivel,
      nombre: nombreAlphaPresentacion(n.nombre, n.nivel),
      romano: ROMANOS[n.nivel - 1] ?? String(n.nivel),
      requisito:
        n.reservasRequeridas === 0
          ? 'Desde que te registras'
          : `Desde ${n.reservasRequeridas} reservas completadas`,
      descuentoPct: n.descuentoPct,
      beneficios: n.beneficios.map((texto) => ({ icono: iconoDeBeneficio(texto), texto })),
      esActual: e?.nivelActual === n.nivel,
      esSiguiente: e?.siguienteNivel?.nivel === n.nivel,
      desbloqueado: (e?.reservasCompletadas ?? 0) >= n.reservasRequeridas,
    }));
  });

  // Carrusel "Ventajas disponibles para ti" (HU-13.3)
  readonly adheridos = signal<AlphaVentajaApi[]>([]);
  readonly fallbackImg = IMG_FALLBACK;
  readonly enlaceAServicio = enlaceAServicio;

  /** Descuento del nivel actual; 0 si el usuario no tiene sesión o estado Alpha. */
  readonly descuentoActual = computed(() => this.estado()?.descuentoPct ?? 0);

  /**
   * Límites del descuento configurados en el panel (TCK-8030 §10). Sólo se
   * enumeran los que existen: repetir "sin tope" o "todas las categorías" en
   * cada nivel llenaría la tarjeta de ruido.
   */
  readonly condicionesDescuento = computed<string[]>(() => {
    const e = this.estado();
    if (!e || e.descuentoPct <= 0) return [];

    const condiciones: string[] = [];
    if (e.descuentoMaximoEur != null) {
      condiciones.push(`Hasta ${euros(e.descuentoMaximoEur)} de descuento por reserva`);
    }
    const verticales = e.verticalesAplicables ?? [];
    if (verticales.length) {
      condiciones.push(`Válido en ${verticales.map((v) => verticalUi(v).labelCorto).join(', ')}`);
    }
    if (e.vigenciaHasta) {
      condiciones.push(`Vigente hasta el ${new Date(e.vigenciaHasta).toLocaleDateString('es-ES')}`);
    }
    return condiciones;
  });

  async ngOnInit(): Promise<void> {
    try {
      const [niveles, estado, ventajas] = await Promise.all([
        this.alphaService.niveles(),
        this.alphaService.miEstado().catch(() => null),
        // Sin sesión o sin adheridos el carrusel simplemente no se pinta.
        this.alphaService.ventajas().catch(() => [] as AlphaVentajaApi[]),
      ]);
      this.niveles.set(niveles);
      this.estado.set(estado);
      this.adheridos.set(ventajas);
    } catch {
      // API no disponible: la pantalla queda vacía en lugar de romper el perfil.
    } finally {
      this.cargando.set(false);
    }
  }
}
