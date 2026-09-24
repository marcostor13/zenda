import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RsNavbarComponent } from '../../../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../../../shared/components/icon/rs-icon.component';
import { TraducirPipe } from '../../../../core/i18n/traducir.pipe';

const PASOS = ['Viaje', 'Mascota', 'Elige', 'Datos', 'Pago'] as const;

/**
 * Marco común de las pantallas del flujo de Transporte: barra superior, pasos
 * (el cliente sabe siempre cuánto le queda), volver, título y el contenido.
 * Mobile-first: una sola columna estrecha, como el mockup.
 */
@Component({
  selector: 'app-marco-viaje',
  standalone: true,
  imports: [RouterLink, RsNavbarComponent, RsIconComponent, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="dk-pagina">
  <rs-navbar />
  <main class="mv rs-wrap" [class.mv--ancho]="ancho()">
    @if (paso() > 0) {
      <nav class="rs-steps mv__pasos" [attr.aria-label]="'Pasos de la reserva' | t">
        @for (nombre of pasos; track nombre; let i = $index; let ultimo = $last) {
          <div class="rs-steps__item" [class.active]="paso() >= i + 1" [class.done]="paso() > i + 1"
               [attr.aria-current]="paso() === i + 1 ? 'step' : null">
            <div class="rs-steps__num">
              @if (paso() > i + 1) { <rs-icon name="check" [size]="14" [stroke]="3" /> } @else { {{ i + 1 }} }
            </div>
            <span>{{ nombre | t }}</span>
          </div>
          @if (!ultimo) { <div class="rs-steps__line"></div> }
        }
      </nav>
    }

    @if (volverA()) {
      <a class="mv__volver" [routerLink]="volverA()">
        <rs-icon name="arrow-left" [size]="16" [stroke]="2"></rs-icon> {{ 'Volver' | t }}
      </a>
    }

    <header class="mv__cabecera">
      @if (antetitulo()) { <p class="rs-label-caps mv__ante">{{ antetitulo() | t }}</p> }
      <h1 class="mv__titulo">{{ titulo() | t }}</h1>
      @if (subtitulo()) { <p class="mv__sub">{{ subtitulo() | t }}</p> }
    </header>

    <ng-content />
  </main>
</div>
  `,
  styles: [`
    :host { display: block; }
    .mv { max-width: 640px; padding-top: var(--sp-5); padding-bottom: var(--sp-10); }
    .mv--ancho { max-width: 960px; }
    .mv__pasos { margin-bottom: var(--sp-5); overflow: hidden; }
    .mv__volver {
      display: inline-flex; align-items: center; gap: var(--sp-1); margin-bottom: var(--sp-3);
      font-size: var(--f-sm); font-weight: var(--w-6); color: var(--c-accent);
    }
    .mv__cabecera { margin-bottom: var(--sp-5); }
    .mv__ante { margin: 0 0 var(--sp-1); color: var(--dk-gold-text); }
    .mv__titulo {
      margin: 0; font-family: var(--font-display); font-size: var(--f-3xl); font-weight: var(--w-8);
      line-height: 1.15; color: var(--dk-blue-text);
    }
    .mv__sub { margin: var(--sp-2) 0 0; font-size: var(--f-md); color: var(--t-300); }
    @media (max-width: 640px) {
      .mv__titulo { font-size: var(--f-2xl); }
    }
  `],
})
export class MarcoViajeComponent {
  readonly pasos = PASOS;
  /** 1-5; 0 = sin indicador de pasos (confirmación, presupuestos). */
  readonly paso = input(0);
  readonly titulo = input.required<string>();
  readonly subtitulo = input('');
  readonly antetitulo = input('');
  readonly volverA = input<string | null>(null);
  readonly ancho = input(false);
}
