import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';

interface Pregunta {
  readonly p: string;
  readonly r: string;
}

type Publico = 'cliente' | 'comercio';

const FAQ: Record<Publico, readonly Pregunta[]> = {
  cliente: [
    {
      p: '¿Cuándo se me cobra la reserva?',
      r: 'Al confirmar. El importe queda retenido hasta que el servicio se presta, así que si algo sale mal el dinero sigue protegido.',
    },
    {
      p: 'El profesional pide un suplemento. ¿Me lo pueden cobrar sin avisar?',
      r: 'No. Ningún importe adicional se cobra sin tu aprobación: recibirás un correo con el precio inicial, el nuevo precio y el motivo, y decides tú. Si lo rechazas se te reembolsa reteniendo solo un cargo mínimo de gestión.',
    },
    {
      p: '¿Puedo cancelar?',
      r: 'Sí, según la política de cancelación de cada comercio, que aparece siempre antes de pagar y en el detalle de tu reserva.',
    },
    {
      p: '¿Para qué sirve registrar la ficha de mi perro?',
      r: 'Para no repetir sus datos en cada reserva, ver solo servicios compatibles con él y recibir un precio ajustado a su perfil en lugar de una estimación genérica.',
    },
    {
      p: '¿Quién ve el historial de mi mascota?',
      r: 'Solo tú decides qué comparte cada tipo de servicio. Por defecto, lo que registra un profesional no sale de su propia categoría.',
    },
    {
      p: 'Veo los precios en otra moneda. ¿En qué se me cobra?',
      r: 'Siempre en euros. La conversión que ves es orientativa, para ayudarte a hacerte una idea.',
    },
  ],
  comercio: [
    {
      p: '¿Cuánto cobra Doogking por reserva?',
      r: 'Una comisión sobre el importe de la reserva, distinta según la categoría. La ves desglosada en cada liquidación, junto con los costes de la pasarela de pago.',
    },
    {
      p: '¿Cuándo recibo el dinero?',
      r: 'Tras prestarse el servicio, en la liquidación correspondiente: importe total menos comisión de plataforma y comisión de la pasarela.',
    },
    {
      p: '¿Cómo evito recibir reservas que no puedo atender?',
      r: 'Manteniendo tu disponibilidad al día y configurando el apartado "apto para" de cada servicio. Los servicios sin plazas libres dejan de aparecer en el buscador.',
    },
    {
      p: 'He detectado algo en recepción que cambia el precio. ¿Qué hago?',
      r: 'Solicita un ajuste desde la reserva, con los suplementos que tengas configurados y una foto del estado del animal. El cliente lo aprueba o lo rechaza; nunca se cobra sin su visto bueno.',
    },
    {
      p: '¿Cómo doy de alta mi empresa?',
      r: 'Desde "Registra tu empresa" en la cabecera. Tras el alta, un administrador revisa los datos antes de que tus servicios se publiquen.',
    },
  ],
};

/**
 * Centro de ayuda (R4). Responde por rol, porque las dudas de un dueño y las de
 * un comercio no se parecen en nada, y deja siempre una vía de contacto humana.
 */
@Component({
  selector: 'app-ayuda',
  standalone: true,
  imports: [RouterLink, RsNavbarComponent, RsIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="ayuda-page">
  <rs-navbar />

  <section class="rs-section rs-section--sm">
    <div class="rs-wrap rs-wrap--lg">
      <header class="ay-head">
        <p class="ay-head__eyebrow">Centro de ayuda</p>
        <h1>¿En qué podemos ayudarte?</h1>
        <p class="ay-head__sub">
          Las dudas más frecuentes, y una vía directa con nosotros si no encuentras la tuya.
        </p>
      </header>

      <div class="ay-tabs" role="tablist" aria-label="Tipo de usuario">
        <button type="button" role="tab" class="ay-tab" [class.is-on]="publico() === 'cliente'"
                [attr.aria-selected]="publico() === 'cliente'" (click)="publico.set('cliente')">
          <rs-icon name="paw" [size]="16" [stroke]="2"></rs-icon> Tengo una mascota
        </button>
        <button type="button" role="tab" class="ay-tab" [class.is-on]="publico() === 'comercio'"
                [attr.aria-selected]="publico() === 'comercio'" (click)="publico.set('comercio')">
          <rs-icon name="building" [size]="16" [stroke]="2"></rs-icon> Tengo un negocio
        </button>
      </div>

      <ul class="ay-faq">
        @for (f of preguntas(); track f.p) {
          <li class="ay-item">
            <details>
              <summary>
                <span>{{ f.p }}</span>
                <rs-icon name="chevron-down" [size]="18" [stroke]="2.5" class="ay-item__caret"></rs-icon>
              </summary>
              <p>{{ f.r }}</p>
            </details>
          </li>
        }
      </ul>

      <div class="ay-contacto">
        <div>
          <h2>¿No encuentras tu respuesta?</h2>
          <p>Escríbenos y te contestamos en menos de 24 horas laborables.</p>
        </div>
        <div class="ay-contacto__acciones">
          <a class="rs-btn rs-btn--primary" href="mailto:soporte&#64;doogking.com">
            <rs-icon name="mail" [size]="16" [stroke]="2"></rs-icon>
            Escribir a soporte
          </a>
          <a class="rs-btn rs-btn--outline" routerLink="/reservas">
            <rs-icon name="calendar" [size]="16" [stroke]="2"></rs-icon>
            Ver mis reservas
          </a>
        </div>
      </div>
    </div>
  </section>
</div>
  `,
  styles: [`
    :host { display: block; }
    .ayuda-page { min-height: 100vh; background: var(--c-base); }

    .ay-head { margin-bottom: var(--sp-8); max-width: 60ch; }
    .ay-head__eyebrow {
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .12em; text-transform: uppercase; color: var(--dk-gold);
      margin-bottom: var(--sp-2);
    }
    .ay-head h1 { font-size: var(--f-3xl); color: var(--dk-blue); letter-spacing: -.02em; }
    .ay-head__sub { color: var(--t-400); margin-top: var(--sp-2); font-size: var(--f-md); }

    .ay-tabs { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-6); flex-wrap: wrap; }
    .ay-tab {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-3) var(--sp-5);
      border: 1px solid var(--b-2); border-radius: var(--r-full);
      background: var(--c-card); color: var(--t-300); cursor: pointer;
      font-size: var(--f-sm); font-weight: var(--w-6);
      transition: border-color var(--d-2), background var(--d-2), color var(--d-2);
      &:hover { border-color: var(--c-accent); }
      &.is-on { background: var(--dk-blue); border-color: var(--dk-blue); color: #fff; }
    }

    .ay-faq { list-style: none; display: flex; flex-direction: column; gap: var(--sp-3); }
    .ay-item {
      background: var(--c-card);
      border: 1px solid var(--b-1); border-radius: var(--r-lg);
      overflow: hidden;

      summary {
        display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4);
        padding: var(--sp-5);
        cursor: pointer; list-style: none;
        font-size: var(--f-md); font-weight: var(--w-6); color: var(--t-100);
        &::-webkit-details-marker { display: none; }
      }
      p { padding: 0 var(--sp-5) var(--sp-5); color: var(--t-400); line-height: 1.65; max-width: 72ch; }
      details[open] .ay-item__caret { transform: rotate(180deg); }
    }
    .ay-item__caret { color: var(--dk-blue); flex-shrink: 0; transition: transform var(--d-2); }

    .ay-contacto {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--sp-6); flex-wrap: wrap;
      margin-top: var(--sp-10); padding: var(--sp-8);
      background: var(--c-card);
      border: 1px solid var(--b-1); border-radius: var(--r-xl);

      h2 { font-size: var(--f-xl); color: var(--dk-blue); margin-bottom: var(--sp-2); }
      p { color: var(--t-400); }
    }
    .ay-contacto__acciones { display: flex; gap: var(--sp-3); flex-wrap: wrap; }
  `],
})
export class AyudaComponent {
  readonly publico = signal<Publico>('cliente');

  readonly preguntas = computed(() => FAQ[this.publico()]);
}
