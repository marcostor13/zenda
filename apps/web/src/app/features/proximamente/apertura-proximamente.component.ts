import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
import { ListaEsperaService } from './lista-espera.service';

/** Qué parte de la plataforma está aún por abrir. Llega por `data.apertura` de la ruta. */
export type AperturaPendiente = 'reservas' | 'comercios';

interface TextosApertura {
  readonly badge: string;
  readonly titulo: string;
  readonly texto: string;
  readonly ctaTitulo: string;
  readonly ctaTexto: string;
  readonly volverRuta: string;
  readonly volverTexto: string;
  /** Se guarda con el email: separa a los clientes de los negocios en la lista de espera. */
  readonly origen: string;
}

const TEXTOS: Readonly<Record<AperturaPendiente, TextosApertura>> = {
  reservas: {
    badge: 'Reservas muy pronto',
    titulo: 'Las reservas abren muy pronto',
    texto:
      'Ya puedes crear tu cuenta, registrar a tus perros, explorar los servicios y guardar tus favoritos. Estamos sumando a los primeros profesionales y, en cuanto estén listos, podrás reservar y pagar desde aquí.',
    ctaTitulo: '¿Te avisamos cuando puedas reservar?',
    ctaTexto: 'Déjanos tu email y te escribimos el día que se abran las reservas.',
    volverRuta: '/',
    volverTexto: 'Seguir explorando',
    origen: 'reservas-proximamente',
  },
  comercios: {
    badge: 'Alta de negocios muy pronto',
    titulo: 'El registro de negocios abre muy pronto',
    texto:
      'Estamos preparando la llegada de los primeros profesionales a Doogking: residencias, veterinarios, peluquerías, adiestradores y transportistas. Muy pronto podrás dar de alta tu negocio y recibir reservas.',
    ctaTitulo: '¿Tienes un negocio? Sé de los primeros',
    ctaTexto: 'Déjanos tu email y te avisamos en cuanto se abra el alta de negocios.',
    volverRuta: '/para-comercios',
    volverTexto: 'Ver qué ofrece Doogking a los negocios',
    origen: 'comercios-proximamente',
  },
};

/**
 * Pantalla de "muy pronto" de una parte concreta de la plataforma (reservas o
 * alta de negocios) durante el lanzamiento por fases. A diferencia de
 * `ProximamenteComponent`, el resto de la web sigue abierta: lleva la cabecera
 * normal y un camino de vuelta, y capta el email con su propio origen.
 */
@Component({
  selector: 'app-apertura-proximamente',
  standalone: true,
  imports: [TraducirPipe, ReactiveFormsModule, RouterLink, RsIconComponent, RsNavbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <rs-navbar />
    <main class="ap rs-container rs-container--sm">
      <p class="ap__badge">
        <rs-icon name="rocket" [size]="15" [stroke]="2.25" /> {{ textos().badge | t }}
      </p>
      <h1 class="ap__titulo">{{ textos().titulo | t }}</h1>
      <p class="ap__texto">{{ textos().texto | t }}</p>

      <section class="ap__cta rs-card" aria-labelledby="ap-cta-titulo">
        <h2 class="ap__cta-titulo" id="ap-cta-titulo">{{ textos().ctaTitulo | t }}</h2>
        <p class="ap__cta-texto">{{ textos().ctaTexto | t }}</p>

        @if (suscrito()) {
          <p class="rs-alert rs-alert--success" role="status">{{ mensaje() | t }}</p>
        } @else {
          <form class="ap__form" [formGroup]="formulario" (ngSubmit)="suscribir()">
            <div class="rs-form-group ap__campo">
              <label class="rs-label" for="ap-email">{{ 'Tu email' | t }}</label>
              <input
                id="ap-email"
                type="email"
                class="rs-input"
                [class.rs-input--error]="hayError()"
                formControlName="email"
                placeholder="tu@email.com"
                autocomplete="email"
                inputmode="email"
                [attr.aria-invalid]="hayError() ? 'true' : null" />
              @if (hayError()) {
                <p class="rs-field-error" role="alert">{{ mensaje() | t }}</p>
              }
            </div>
            <button type="submit" class="rs-btn rs-btn--gold rs-btn--lg" [disabled]="enviando()">
              {{ (enviando() ? 'Enviando…' : 'Avísame') | t }}
            </button>
          </form>
        }
      </section>

      <a class="rs-btn rs-btn--ghost ap__volver" [routerLink]="textos().volverRuta">
        <rs-icon name="arrow-left" [size]="16" [stroke]="2" /> {{ textos().volverTexto | t }}
      </a>
    </main>
  `,
  styles: [`
    :host { display: block; background: var(--c-base); min-height: 100vh; }

    .ap {
      padding-block: var(--sp-12) var(--sp-16);
      text-align: center;
    }

    .ap__badge {
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
      padding: var(--sp-2) var(--sp-5);
      margin-bottom: var(--sp-5);
    }

    .ap__titulo {
      font-family: var(--font-display);
      font-weight: var(--w-8);
      color: var(--dk-blue);
      font-size: clamp(1.6rem, 4vw, 2.4rem);
      line-height: 1.2;
      margin-bottom: var(--sp-4);
    }

    .ap__texto {
      color: var(--t-300);
      line-height: 1.6;
      margin-bottom: var(--sp-8);
    }

    .ap__cta {
      text-align: left;
      padding: var(--sp-6);
      margin-bottom: var(--sp-6);
    }

    .ap__cta-titulo {
      font-family: var(--font-display);
      font-weight: var(--w-7);
      color: var(--t-100);
      font-size: var(--f-lg);
      margin-bottom: var(--sp-2);
    }

    .ap__cta-texto {
      color: var(--t-400);
      font-size: var(--f-sm);
      margin-bottom: var(--sp-4);
    }

    .ap__form {
      display: flex;
      gap: var(--sp-3);
      align-items: flex-end;
    }

    .ap__campo { flex: 1; margin-bottom: 0; }

    .ap__volver { display: inline-flex; gap: var(--sp-2); }

    @media (max-width: 520px) {
      .ap__form { flex-direction: column; align-items: stretch; }
    }
  `],
})
export class AperturaProximamenteComponent {
  private readonly fb = inject(FormBuilder);
  private readonly listaEspera = inject(ListaEsperaService);
  private readonly route = inject(ActivatedRoute);

  private readonly apertura = toSignal(
    this.route.data.pipe(map((data) => (data['apertura'] as AperturaPendiente | undefined) ?? 'reservas')),
    { initialValue: 'reservas' as AperturaPendiente },
  );

  readonly textos = computed(() => TEXTOS[this.apertura()]);

  readonly formulario = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly enviando = signal(false);
  readonly suscrito = signal(false);
  readonly mensaje = signal('');
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
    this.listaEspera.suscribir(email, this.textos().origen).subscribe({
      next: (respuesta) => {
        this.enviando.set(false);
        this.suscrito.set(true);
        this.mensaje.set(
          respuesta.yaRegistrado
            ? 'Ya te teníamos apuntado. Te avisaremos en cuanto abramos.'
            : '¡Listo! Te avisaremos en cuanto abramos.',
        );
      },
      error: () => {
        this.enviando.set(false);
        this.mensaje.set('No hemos podido guardar tu email. Inténtalo de nuevo en un momento.');
      },
    });
  }
}
