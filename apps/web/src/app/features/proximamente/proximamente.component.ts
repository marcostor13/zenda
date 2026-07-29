import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BRAND, CATEGORIA_ICONOS } from '../../shared/media/images';

/**
 * Pantalla pública "muy pronto" servida mientras `environment.underConstruction`
 * está activo (ver `underConstructionGuard`). Sin lógica: solo presentación.
 */
@Component({
  selector: 'app-proximamente',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="proximamente">
      <div class="proximamente__card">
        <img [src]="logo" alt="Doogking" class="proximamente__logo" />

        <p class="proximamente__eyebrow">Muy pronto</p>
        <h1 class="proximamente__title">
          <span class="proximamente__title-line proximamente__title-line--blue">Todo para tu rey,</span>
          <span class="proximamente__title-line proximamente__title-line--gold">en un solo lugar</span>
        </h1>

        <p class="proximamente__subtitle">
          Estamos dando los últimos retoques a Doogking: alojamiento, veterinario, peluquería,
          transporte y adiestramiento para tu perro, todo en una sola plataforma. Vuelve pronto.
        </p>

        <div class="proximamente__categorias" aria-hidden="true">
          @for (icono of categorias; track icono) {
            <span class="proximamente__categoria">
              <img [src]="icono" alt="" />
            </span>
          }
        </div>
      </div>

      <div class="proximamente__navy">
        <p class="proximamente__navy-text">🐾 Gracias por tu paciencia — © 2026 Doogking</p>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .proximamente {
      position: relative;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: var(--c-card);
      padding: var(--sp-8) var(--sp-4) calc(140px + var(--sp-8));
      text-align: center;
      overflow: hidden;
    }

    .proximamente__card {
      position: relative;
      z-index: 1;
      max-width: 640px;
      animation: fadeUp .6s ease both;
    }

    .proximamente__logo {
      width: min(320px, 60vw);
      height: auto;
      margin-inline: auto;
      margin-bottom: var(--sp-6);
    }

    .proximamente__eyebrow {
      font-family: var(--font-accent);
      font-weight: var(--w-7);
      text-transform: uppercase;
      letter-spacing: .12em;
      font-size: var(--f-sm);
      color: var(--dk-gold-text);
      margin-bottom: var(--sp-2);
    }

    .proximamente__title {
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

    .proximamente__title-line--blue { color: var(--dk-blue); }
    .proximamente__title-line--gold { color: var(--dk-gold); }

    .proximamente__subtitle {
      max-width: 52ch;
      margin-inline: auto;
      font-size: var(--f-md);
      line-height: 1.6;
      color: var(--t-300);
    }

    .proximamente__categorias {
      display: flex;
      justify-content: center;
      gap: var(--sp-4);
      margin-top: var(--sp-8);
      flex-wrap: wrap;
    }

    .proximamente__categoria {
      width: 56px;
      height: 56px;
      border-radius: var(--r-full);
      background: var(--c-accent-lo);
      display: flex;
      align-items: center;
      justify-content: center;

      img { width: 26px; height: 26px; }
    }

    .proximamente__navy {
      position: absolute;
      left: 50%;
      bottom: 0;
      transform: translateX(-50%);
      width: 160%;
      height: 220px;
      background: var(--dk-blue-deep);
      border-radius: 50% 50% 0 0 / 70px 70px 0 0;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: var(--sp-6);
    }

    .proximamente__navy-text {
      max-width: 90%;
      font-size: var(--f-sm);
      font-weight: var(--w-6);
      color: rgba(255,255,255,.85);
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class ProximamenteComponent {
  readonly logo = BRAND.logoMark;
  readonly categorias = [
    CATEGORIA_ICONOS['alojamiento'],
    CATEGORIA_ICONOS['transporte'],
    CATEGORIA_ICONOS['veterinaria'],
    CATEGORIA_ICONOS['peluqueria'],
    CATEGORIA_ICONOS['adiestramiento'],
  ];
}
