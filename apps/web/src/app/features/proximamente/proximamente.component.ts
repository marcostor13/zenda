import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsSocialIconComponent } from '../../shared/components/social-icon/rs-social-icon.component';
import { REDES_SOCIALES_DESTACADAS } from '../../shared/catalogos/redes-sociales.catalogo';
import { BRAND, CATEGORIA_ICONOS } from '../../shared/media/images';
import { ListaEsperaService } from './lista-espera.service';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

/** Servicio anunciado en la rejilla de alcance de la plataforma. */
interface ServicioAnunciado {
  readonly icono: string;
  readonly label: string;
}

/** Promesa de valor de una línea, bajo el texto principal. */
interface VentajaAnunciada {
  readonly texto: string;
}


/**
 * Pantalla pública "muy pronto" servida mientras `environment.underConstruction`
 * está activo (ver `underConstructionGuard`). Además de anunciar el lanzamiento,
 * captura emails para la lista de espera: es el único punto de conversión que
 * tiene la marca antes de abrir.
 */
@Component({
  selector: 'app-proximamente',
  standalone: true,
  imports: [
    TraducirPipe, ReactiveFormsModule, RsIconComponent, RsSocialIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pm">
      <section class="pm__hero">
        <img [src]="logo" alt="Doogking" class="pm__logo" />

        <p class="pm__badge">
          <rs-icon name="rocket" [size]="15" [stroke]="2.25" /> {{ 'Estamos preparando algo muy grande' | t }}
        </p>

        <h1 class="pm__title">
          <span class="pm__title-line pm__title-line--blue">{{ 'Todo para tu rey,' | t }}</span>
          <span class="pm__title-line pm__title-line--gold">{{ 'en un solo lugar' | t }}</span>
        </h1>

        <p class="pm__lead">
          {{ 'Estamos ultimando los detalles de Doogking, la plataforma que reunirá todo lo que tu mascota necesita en un solo lugar. Muy pronto podrás reservar con profesionales de confianza de forma rápida, sencilla y segura.' | t }}
        </p>

        <ul class="pm__ventajas">
          @for (ventaja of ventajas; track ventaja.texto) {
            <li class="pm__ventaja">
              <rs-icon class="pm__ventaja-check" name="check" [size]="16" [stroke]="3" />
              {{ ventaja.texto }}
            </li>
          }
        </ul>
      </section>

      <section class="pm__servicios" aria-labelledby="pm-servicios-titulo">
        <h2 class="pm__servicios-titulo" id="pm-servicios-titulo">
          {{ 'Todo lo que encontrarás en Doogking' | t }}
        </h2>
        <ul class="pm__grid">
          @for (servicio of servicios; track servicio.label) {
            <li class="pm__servicio">
              <span class="pm__servicio-icono">
                <img [src]="servicio.icono" alt="" aria-hidden="true" />
              </span>
              <span class="pm__servicio-label">{{ servicio.label | t }}</span>
            </li>
          }
        </ul>
        <p class="pm__confianza">
          {{ 'La plataforma donde propietarios y profesionales se encuentran con total confianza.' | t }}
        </p>
      </section>

      <section class="pm__cta" aria-labelledby="pm-cta-titulo">
        <div class="pm__cta-inner">
          <h2 class="pm__cta-titulo" id="pm-cta-titulo">
            {{ '¿Quieres ser de los primeros en conocer Doogking?' | t }}
          </h2>
          <p class="pm__cta-texto">
            {{ 'Déjanos tu email y te avisamos el día que abramos. Sin spam: solo el aviso de lanzamiento.' | t }}
          </p>

          @if (suscrito()) {
            <p class="pm__cta-exito" role="status">
              <rs-icon name="party-popper" [size]="18" [stroke]="2" /> {{ mensaje() }}
            </p>
          } @else {
            <form class="pm__cta-form" [formGroup]="formulario" (ngSubmit)="suscribir()">
              <label class="pm__cta-label" for="pm-email">
                <rs-icon name="mail" [size]="13" [stroke]="2.25" /> {{ 'Tu email' | t }}
              </label>
              <div class="pm__cta-fila">
                <input
                  id="pm-email"
                  type="email"
                  class="pm__cta-input"
                  formControlName="email"
                  placeholder="tu@email.com"
                  autocomplete="email"
                  [attr.aria-invalid]="hayError() ? 'true' : null" inputmode="email" />
                <button
                  type="submit"
                  class="rs-btn rs-btn--gold rs-btn--lg"
                  [disabled]="enviando()"
                >
                  {{ enviando() ? 'Enviando…' : 'Avísame' }}
                </button>
              </div>
              @if (mensaje()) {
                <p class="pm__cta-mensaje" role="alert">{{ mensaje() }}</p>
              }
            </form>
          }

          <p class="pm__cta-redes">
            <span class="pm__cta-redes-label">{{ 'Síguenos' | t }}</span>
            @for (red of redes; track red.nombre) {
              <a
                class="pm__cta-red"
                [href]="red.url"
                target="_blank"
                rel="noopener"
                [attr.title]="red.nombre">
                <rs-social-icon [name]="red.icono" [size]="20" [etiqueta]="red.nombre" />
              </a>
            }
          </p>

          <p class="pm__cta-legal">
            <rs-icon name="paw" [size]="14" [stroke]="2" /> {{ 'Gracias por tu paciencia — © 2026 Doogking' | t }}
          </p>
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .pm {
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      background: var(--c-card);
      text-align: center;
    }

    /* ── Hero ─────────────────────────────────────────────────────── */
    .pm__hero {
      padding: var(--sp-12) var(--sp-4) var(--sp-8);
      max-width: 720px;
      margin-inline: auto;
      animation: fadeUp .6s ease both;
    }

    .pm__logo {
      width: min(300px, 58vw);
      height: auto;
      margin-inline: auto;
      margin-bottom: var(--sp-5);
    }

    .pm__badge {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      font-family: var(--font-accent);
      font-weight: var(--w-7);
      text-transform: uppercase;
      letter-spacing: .08em;
      font-size: var(--f-sm);
      color: var(--dk-blue-deep);
      background: var(--g-warm);
      border-radius: var(--r-full);
      padding: var(--sp-3) var(--sp-6);
      margin-bottom: var(--sp-5);
      box-shadow: var(--sh-glow);
    }

    .pm__title {
      font-family: var(--font-accent);
      font-weight: var(--w-7);
      text-transform: uppercase;
      letter-spacing: .01em;
      line-height: 1.25;
      font-size: clamp(1.5rem, 4.2vw, 2.5rem);
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
      margin-bottom: var(--sp-5);
    }

    .pm__title-line--blue { color: var(--dk-blue); }
    .pm__title-line--gold { color: var(--dk-gold); }

    .pm__lead {
      max-width: 56ch;
      margin-inline: auto;
      font-size: var(--f-md);
      line-height: 1.65;
      color: var(--t-300);
    }

    .pm__ventajas {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--sp-3) var(--sp-5);
      margin-top: var(--sp-8);
      padding: 0;
    }

    .pm__ventaja {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      font-size: var(--f-base);
      font-weight: var(--w-6);
      color: var(--t-200);
      background: var(--c-accent-lo);
      border-radius: var(--r-full);
      padding: var(--sp-2) var(--sp-5);
    }

    .pm__ventaja-check { color: var(--dk-gold-text); flex: 0 0 auto; }

    /* ── Rejilla de servicios ─────────────────────────────────────── */
    .pm__servicios {
      padding: var(--sp-10) var(--sp-4) var(--sp-12);
      max-width: 880px;
      margin-inline: auto;
      width: 100%;
    }

    .pm__servicios-titulo {
      font-family: var(--font-accent);
      font-weight: var(--w-7);
      text-transform: uppercase;
      letter-spacing: .1em;
      font-size: var(--f-sm);
      color: var(--t-400);
      margin-bottom: var(--sp-8);
    }

    .pm__grid {
      list-style: none;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--sp-6) var(--sp-4);
    }

    .pm__servicio {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-3);
    }

    .pm__servicio-icono {
      width: 60px;
      height: 60px;
      border-radius: var(--r-full);
      background: var(--c-accent-lo);
      display: flex;
      align-items: center;
      justify-content: center;

      img { width: 28px; height: 28px; }
    }

    .pm__servicio-label {
      font-size: var(--f-sm);
      font-weight: var(--w-6);
      line-height: 1.35;
      color: var(--t-200);
      max-width: 14ch;
    }

    .pm__confianza {
      margin-top: var(--sp-10);
      font-family: var(--font-display);
      font-size: var(--f-lg);
      font-weight: var(--w-6);
      line-height: 1.5;
      color: var(--dk-blue-text);
      max-width: 46ch;
      margin-inline: auto;
    }

    /* ── Bloque navy: lista de espera + comunidad ─────────────────── */
    .pm__cta {
      margin-top: auto;
      background: var(--dk-blue-deep);
      border-radius: 50% 50% 0 0 / 70px 70px 0 0;
      padding: var(--sp-12) var(--sp-4) var(--sp-8);
    }

    .pm__cta-inner {
      max-width: 560px;
      margin-inline: auto;
    }

    .pm__cta-titulo {
      font-family: var(--font-display);
      font-weight: var(--w-8);
      font-size: var(--f-xl);
      line-height: 1.3;
      color: #fff;
      margin-bottom: var(--sp-3);
    }

    .pm__cta-texto {
      font-size: var(--f-base);
      line-height: 1.6;
      color: rgba(255,255,255,.78);
      margin-bottom: var(--sp-6);
    }

    .pm__cta-label {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      font-family: var(--font-accent);
      font-weight: var(--w-7);
      text-transform: uppercase;
      letter-spacing: .08em;
      font-size: var(--f-xs);
      color: var(--dk-gold);
      margin-bottom: var(--sp-2);
      text-align: left;
    }

    .pm__cta-fila {
      display: flex;
      gap: var(--sp-3);
      flex-wrap: wrap;
    }

    .pm__cta-input {
      flex: 1 1 220px;
      min-width: 0;
      padding: var(--sp-4) var(--sp-5);
      font-size: var(--f-md);
      color: #fff;
      background: rgba(255,255,255,.10);
      border: 1px solid rgba(255,255,255,.28);
      border-radius: var(--r-xl);
      transition: border-color var(--d-2), background var(--d-2);

      &::placeholder { color: rgba(255,255,255,.5); }

      &:focus {
        outline: none;
        background: rgba(255,255,255,.16);
        border-color: var(--dk-gold);
      }

      &[aria-invalid='true'] { border-color: var(--dk-gold-light); }
    }

    .pm__cta-mensaje {
      margin-top: var(--sp-3);
      font-size: var(--f-sm);
      font-weight: var(--w-6);
      color: var(--dk-gold-light);
      text-align: left;
    }

    .pm__cta-exito {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--sp-2);
      font-size: var(--f-md);
      font-weight: var(--w-6);
      line-height: 1.5;
      color: #fff;
      background: rgba(255,255,255,.10);
      border: 1px solid var(--dk-gold);
      border-radius: var(--r-xl);
      padding: var(--sp-4) var(--sp-5);
    }

    .pm__cta-redes {
      margin-top: var(--sp-8);
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: var(--sp-2) var(--sp-4);
      font-size: var(--f-sm);
    }

    .pm__cta-redes-label { color: rgba(255,255,255,.7); font-weight: var(--w-6); }

    /* El logo sustituye al nombre escrito (TCK-8008): el área táctil la da el
       círculo, no el texto, así que se fija a 44px (mínimo accesible). */
    .pm__cta-red {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: var(--r-full);
      color: var(--dk-gold);
      background: rgba(255,255,255,.10);
      border: 1px solid rgba(255,255,255,.20);
      text-decoration: none;
      transition: color var(--d-2), background var(--d-2), transform var(--d-2);

      &:hover {
        color: var(--dk-blue-deep);
        background: var(--dk-gold);
        border-color: var(--dk-gold);
        transform: translateY(-2px);
      }
    }

    .pm__cta-legal {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--sp-2);
      margin-top: var(--sp-8);
      font-size: var(--f-sm);
      color: rgba(255,255,255,.6);
    }

    @media (max-width: 720px) {
      .pm__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .pm__cta { border-radius: 50% 50% 0 0 / 40px 40px 0 0; }
    }

    /* Cuando el botón ya no cabe junto al input, ocupa el ancho completo:
       un CTA estrecho y descolgado a la izquierda pierde toda la fuerza. */
    @media (max-width: 520px) {
      .pm__cta-fila .rs-btn { width: 100%; }
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class ProximamenteComponent {
  private readonly fb = inject(FormBuilder);
  private readonly listaEspera = inject(ListaEsperaService);

  readonly logo = BRAND.logoMark;

  readonly ventajas: readonly VentajaAnunciada[] = [
    { texto: 'Reserva en menos de un minuto' },
    { texto: 'Profesionales verificados' },
    { texto: 'Todo para tu mascota desde una sola plataforma' },
  ];

  /**
   * Alcance completo del proyecto, no solo los verticales ya reservables: el
   * visitante debe entender de un vistazo hasta dónde llega Doogking (TCK-8004).
   */
  readonly servicios: readonly ServicioAnunciado[] = [
    { icono: CATEGORIA_ICONOS['alojamiento'], label: 'Residencias' },
    { icono: CATEGORIA_ICONOS['hoteles'], label: 'Hoteles pet friendly' },
    { icono: CATEGORIA_ICONOS['veterinaria'], label: 'Veterinarios' },
    { icono: CATEGORIA_ICONOS['peluqueria'], label: 'Peluquerías' },
    { icono: CATEGORIA_ICONOS['transporte'], label: 'Transporte' },
    { icono: CATEGORIA_ICONOS['adiestramiento'], label: 'Adiestradores' },
    { icono: CATEGORIA_ICONOS['seguros'], label: 'Seguros' },
    { icono: CATEGORIA_ICONOS['funerarios'], label: 'Crematorios' },
    { icono: CATEGORIA_ICONOS['explora'], label: 'Explora con tu mascota' },
  ];

  readonly redes = REDES_SOCIALES_DESTACADAS;

  readonly formulario = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly enviando = signal(false);
  readonly suscrito = signal(false);
  readonly mensaje = signal('');

  /** true mientras el mensaje visible corresponde a un fallo, no a un éxito. */
  readonly hayError = computed(() => !this.suscrito() && this.mensaje() !== '');

  suscribir(): void {
    if (this.enviando()) return;

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.mensaje.set('Escribe un email válido para que podamos avisarte.');
      return;
    }

    this.enviar(this.formulario.getRawValue().email);
  }

  private enviar(email: string): void {
    this.enviando.set(true);
    this.mensaje.set('');

    this.listaEspera.suscribir(email).subscribe({
      next: (respuesta) => {
        this.enviando.set(false);
        this.suscrito.set(true);
        this.mensaje.set(
          respuesta.yaRegistrado
            ? 'Ya te teníamos apuntado. Te avisaremos en cuanto abramos.'
            : '¡Listo! Serás de los primeros en entrar en Doogking.',
        );
      },
      error: () => {
        this.enviando.set(false);
        this.mensaje.set('No hemos podido guardar tu email. Inténtalo de nuevo en un momento.');
      },
    });
  }
}
