import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsBrandIconComponent, type MarcaPagoKey } from '../../shared/components/brand-icon/rs-brand-icon.component';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

@Component({
  selector: 'app-perfil-pagos',
  standalone: true,
  imports: [
    TraducirPipe, RouterLink, RsNavbarComponent, RsIconComponent, RsBrandIconComponent
  ],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">

    <a routerLink="/perfil" class="back-link">
      <rs-icon name="arrow-left" [size]="14" [stroke]="2"></rs-icon>
      {{ 'Volver al perfil' | t }}
    </a>

    <div class="page-header">
      <h1>{{ 'Métodos de pago' | t }}</h1>
      <p>{{ 'Gestiona las tarjetas asociadas a tu cuenta para reservar más rápido.' | t }}</p>
    </div>

    <!-- Info about payment security -->
    <div class="rs-alert rs-alert--info" style="max-width:640px;margin-bottom:var(--sp-6)">
      <rs-icon name="shield-check" [size]="16" [stroke]="2"></rs-icon>
      {{ 'Tus datos de pago están protegidos por' | t }} <strong>Stripe</strong>{{ '. Nunca almacenamos los números de tarjeta en nuestros servidores.' | t }}
    </div>

    <!-- Empty state -->
    <div class="rs-card empty-card">
      <div class="empty-icon">
        <rs-icon name="credit-card" [size]="32" [stroke]="1.25"></rs-icon>
      </div>
      <h2>{{ 'No tienes métodos de pago guardados' | t }}</h2>
      <p>{{ 'Añade una tarjeta para agilizar tus futuras reservas. Solo necesitarás confirmar el importe.' | t }}</p>
      <div class="empty-actions">
        <button class="rs-btn rs-btn--primary" (click)="abrirPortalStripe()">
          <rs-icon name="plus" [size]="15" [stroke]="2.5"></rs-icon>
          {{ 'Añadir tarjeta' | t }}
        </button>
      </div>
    </div>

    <!-- Accepted cards section -->
    <div class="rs-card accepted-card">
      <h3>{{ 'Métodos de pago aceptados' | t }}</h3>
      <div class="card-logos">
        @for (marca of marcasPago; track marca) {
          <rs-brand-icon [name]="marca" [size]="26" />
        }
      </div>
      <p class="accepted-note">
        {{ 'Los pagos se procesan de forma segura mediante Stripe, con cifrado SSL de 256 bits.' | t }}
      </p>

      <!-- Stripe trust badge -->
      <div class="stripe-block">
        <span class="stripe-block__label">{{ 'Procesado por' | t }}</span>
        <div class="stripe-block__logo">
          <rs-brand-icon name="stripe" [size]="22" />
        </div>
        <div class="stripe-block__chips">
          <span class="stripe-chip"><rs-icon name="lock" [size]="12" [stroke]="2"></rs-icon> {{ 'SSL 256-bit' | t }}</span>
          <span class="stripe-chip"><rs-icon name="check" [size]="12" [stroke]="3"></rs-icon> {{ 'PCI DSS Nivel 1' | t }}</span>
        </div>
      </div>
    </div>

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
      margin-bottom: var(--sp-6);
      h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-2); }
      p { color: var(--t-400); font-size: var(--f-sm); }
    }

    .empty-card {
      max-width: 520px; padding: var(--sp-10);
      text-align: center; margin-bottom: var(--sp-5);
      h2 { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); margin: var(--sp-4) 0 var(--sp-2); }
      p { color: var(--t-400); font-size: var(--f-sm); line-height: 1.7; }
    }
    .empty-icon {
      width: 64px; height: 64px; border-radius: 50%;
      background: var(--c-accent-lo); display: flex; align-items: center; justify-content: center;
      color: var(--c-accent); margin: 0 auto;
    }
    .empty-actions { margin-top: var(--sp-6); display: flex; justify-content: center; }

    .accepted-card {
      max-width: 520px; padding: var(--sp-6);
      h3 { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-300); margin-bottom: var(--sp-4); text-transform: uppercase; letter-spacing: .06em; }
    }
    .card-logos { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-4); }
    .accepted-note { font-size: var(--f-xs); color: var(--t-400); line-height: 1.6; margin-bottom: var(--sp-5); }

    .stripe-block {
      display: flex; flex-direction: column; gap: var(--sp-2);
      padding-top: var(--sp-4); border-top: 1px solid var(--b-1);
    }
    .stripe-block__label { font-size: var(--f-xs); color: var(--t-400); }
    .stripe-block__logo { display: flex; align-items: center; }
    .stripe-block__chips { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
    .stripe-chip {
      font-size: 10px; color: var(--t-400); background: var(--c-raised);
      padding: 3px var(--sp-2); border-radius: var(--r-full);
      border: 1px solid var(--b-1);
    }
  `],
})
export class PerfilPagosComponent {
  /** Métodos aceptados, mostrados con su marca y no con el nombre (TCK-8008). */
  readonly marcasPago: readonly MarcaPagoKey[] = [
    'visa', 'mastercard', 'amex', 'apple-pay', 'google-pay',
  ];

  abrirPortalStripe(): void {
    alert('La gestión de tarjetas guardadas estará disponible próximamente. Los pagos se completan de forma segura en cada reserva mediante Stripe Checkout.');
  }
}
