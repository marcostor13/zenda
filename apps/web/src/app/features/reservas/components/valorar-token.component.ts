import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { ReviewsService } from '../services/reviews.service';
import { environment } from '../../../../environments/environment';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

const COMENTARIO_MINIMO = 10;

/**
 * Valoración desde el enlace único del correo (HU-053).
 *
 * El token identifica la reserva concreta, así que el usuario **no tiene que
 * buscar cuál valorar**: llega, puntúa y envía. Ese es todo el motivo por el que
 * esta pantalla existe en vez de mandarle a "Mis reservas".
 */
@Component({
  selector: 'app-valorar-token',
  standalone: true,
  imports: [
    TraducirPipe, FormsModule, RouterLink, RsNavbarComponent, RsIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="vt-page">
  <rs-navbar />

  <div class="rs-wrap rs-wrap--sm vt-wrap">
    @if (cargando()) {
      <p class="vt-cargando">{{ 'Abriendo tu valoración…' | t }}</p>
    } @else if (error()) {
      <div class="rs-card vt-card">
        <h1>{{ 'No hemos podido abrir la valoración' | t }}</h1>
        <p>{{ error() }}</p>
        <a routerLink="/reservas" class="rs-btn rs-btn--primary">{{ 'Ir a mis reservas' | t }}</a>
      </div>
    } @else if (enviada()) {
      <div class="rs-card vt-card vt-card--ok">
        <div class="vt-icono"><rs-icon name="party-popper" [size]="40" [stroke]="1.5"></rs-icon></div>
        <h1>{{ '¡Gracias por tu valoración!' | t }}</h1>
        <p>{{ 'Tu opinión ayuda a otros dueños a elegir bien.' | t }}</p>
        <a routerLink="/explora" class="rs-btn rs-btn--gold">{{ 'Descubre sitios para tu mascota' | t }}</a>
      </div>
    } @else {
      <div class="rs-card vt-card">
        <p class="vt-eyebrow">Reserva {{ codigo() }}</p>
        <h1>{{ '¿Qué tal fue?' | t }}</h1>
        <p class="vt-sub">{{ 'Te llevará menos de 30 segundos.' | t }}</p>

        <div class="vt-estrellas" role="radiogroup" [attr.aria-label]="'Puntuación' | t">
          @for (n of [1,2,3,4,5]; track n) {
            <button type="button" role="radio" class="vt-estrella"
                    [class.is-on]="n <= puntuacion()"
                    [attr.aria-checked]="n === puntuacion()"
                    [attr.aria-label]="n + ' de 5'"
                    (click)="puntuacion.set(n)">
              <rs-icon name="star" [size]="30" [stroke]="1.75" [filled]="n <= puntuacion()"></rs-icon>
            </button>
          }
        </div>

        <div class="rs-field">
          <label class="rs-lbl" for="vt-comentario">{{ 'Cuéntanos un poco más' | t }}</label>
          <textarea id="vt-comentario" class="rs-inp" rows="4" [(ngModel)]="comentario"
                    [placeholder]="'¿Cómo trataron a tu perro? ¿Repetirías?' | t"></textarea>
          <span class="rs-field-hint">Mínimo {{ minimo }} caracteres.</span>
        </div>

        @if (errorEnvio()) { <div class="rs-alert rs-alert--error">{{ errorEnvio() }}</div> }

        <button type="button" class="rs-btn rs-btn--gold rs-btn--block rs-btn--lg"
                [disabled]="enviando()" (click)="enviar()">
          {{ enviando() ? 'Enviando…' : 'Publicar mi valoración' }}
        </button>

        <p class="vt-nota">
          <rs-icon name="lock" [size]="12" [stroke]="2"></rs-icon>
          {{ 'Solo se puede valorar una vez por reserva.' | t }}
        </p>
      </div>
    }
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }
    .vt-page { min-height: 100vh; background: var(--c-base); }
    .vt-wrap { padding-block: var(--sp-10); }
    .vt-card { padding: var(--sp-8); }
    .vt-card--ok { text-align: center; }
    .vt-cargando { color: var(--t-400); }

    .vt-icono { font-size: 3rem; margin-bottom: var(--sp-3); }
    .vt-eyebrow {
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .12em; text-transform: uppercase; color: var(--dk-gold);
      margin-bottom: var(--sp-2);
    }
    .vt-card h1 { font-size: var(--f-2xl); color: var(--dk-blue); }
    .vt-sub { color: var(--t-400); margin-top: var(--sp-2); margin-bottom: var(--sp-6); }

    .vt-estrellas { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-6); }
    .vt-estrella {
      border: none; background: transparent; cursor: pointer;
      font-size: 2.4rem; line-height: 1; color: var(--b-2);
      transition: color var(--d-2), transform var(--d-2);
      &:hover { transform: scale(1.1); }
      &.is-on { color: var(--dk-gold); }
      @media (prefers-reduced-motion: reduce) { &:hover { transform: none; } }
    }

    .vt-nota {
      display: flex; align-items: center; justify-content: center; gap: var(--sp-2);
      margin-top: var(--sp-4); font-size: var(--f-xs); color: var(--t-400);
    }
  `],
})
export class ValorarTokenComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly reviewsService = inject(ReviewsService);

  readonly minimo = COMENTARIO_MINIMO;

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly errorEnvio = signal('');
  readonly enviando = signal(false);
  readonly enviada = signal(false);
  readonly codigo = signal('');
  readonly puntuacion = signal(5);

  comentario = '';

  private reservaId = '';

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    try {
      const abierta = await firstValueFrom(
        this.http.get<{ reservaId: string; codigo: string }>(
          `${environment.apiUrl}/eventos/valoracion/${token}`,
        ),
      );
      this.reservaId = abierta.reservaId;
      this.codigo.set(abierta.codigo);
    } catch (e) {
      const mensaje = (e as { error?: { message?: string } })?.error?.message;
      this.error.set(mensaje ?? 'Este enlace ya no es válido.');
    } finally {
      this.cargando.set(false);
    }
  }

  async enviar(): Promise<void> {
    if (this.comentario.trim().length < COMENTARIO_MINIMO) {
      this.errorEnvio.set(`Escribe al menos ${COMENTARIO_MINIMO} caracteres.`);
      return;
    }

    this.enviando.set(true);
    this.errorEnvio.set('');
    try {
      await this.reviewsService.crear({
        reservaId: this.reservaId,
        puntuacion: this.puntuacion(),
        comentario: this.comentario.trim(),
      });
      this.enviada.set(true);
    } catch (e) {
      const mensaje = (e as { error?: { message?: string } })?.error?.message;
      this.errorEnvio.set(mensaje ?? 'No se pudo publicar la valoración.');
    } finally {
      this.enviando.set(false);
    }
  }
}
