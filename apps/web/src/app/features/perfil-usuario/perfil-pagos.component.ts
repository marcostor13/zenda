import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';

@Component({
  selector: 'app-perfil-pagos',
  standalone: true,
  imports: [RouterLink, RsNavbarComponent, RsIconComponent],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">

    <a routerLink="/perfil" class="back-link">
      <rs-icon name="arrow-left" [size]="14" [stroke]="2"></rs-icon>
      Volver al perfil
    </a>

    <div class="page-header">
      <h1>Métodos de pago</h1>
      <p>Gestiona las tarjetas asociadas a tu cuenta para reservar más rápido.</p>
    </div>

    <!-- Info about payment security -->
    <div class="rs-alert rs-alert--info" style="max-width:640px;margin-bottom:var(--sp-6)">
      <rs-icon name="shield-check" [size]="16" [stroke]="2"></rs-icon>
      Tus datos de pago están protegidos por <strong>Stripe</strong>. Nunca almacenamos los números de tarjeta en nuestros servidores.
    </div>

    <!-- Empty state -->
    <div class="rs-card empty-card">
      <div class="empty-icon">
        <rs-icon name="credit-card" [size]="32" [stroke]="1.25"></rs-icon>
      </div>
      <h2>No tienes métodos de pago guardados</h2>
      <p>Añade una tarjeta para agilizar tus futuras reservas. Solo necesitarás confirmar el importe.</p>
      <div class="empty-actions">
        <button class="rs-btn rs-btn--primary" (click)="abrirPortalStripe()">
          <rs-icon name="plus" [size]="15" [stroke]="2.5"></rs-icon>
          Añadir tarjeta
        </button>
      </div>
    </div>

    <!-- Accepted cards section -->
    <div class="rs-card accepted-card">
      <h3>Métodos de pago aceptados</h3>
      <div class="card-logos">
        <div class="card-logo-chip">
          <rs-icon name="credit-card" [size]="14" [stroke]="2"></rs-icon>
          Visa
        </div>
        <div class="card-logo-chip">
          <rs-icon name="credit-card" [size]="14" [stroke]="2"></rs-icon>
          Mastercard
        </div>
        <div class="card-logo-chip">
          <rs-icon name="credit-card" [size]="14" [stroke]="2"></rs-icon>
          American Express
        </div>
        <div class="card-logo-chip">
          <rs-icon name="zap" [size]="14" [stroke]="2"></rs-icon>
          Apple Pay
        </div>
        <div class="card-logo-chip">
          <rs-icon name="zap" [size]="14" [stroke]="2"></rs-icon>
          Google Pay
        </div>
      </div>
      <p class="accepted-note">
        Los pagos se procesan de forma segura mediante Stripe, con cifrado SSL de 256 bits.
      </p>

      <!-- Stripe trust badge -->
      <div class="stripe-block">
        <span class="stripe-block__label">Procesado por</span>
        <div class="stripe-block__logo">
          <svg width="54" height="22" viewBox="0 0 468 222" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Stripe" role="img">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M0 22.1C0 9.9 9.9 0 22.1 0h423.8c12.2 0 22.1 9.9 22.1 22.1v177.8c0 12.2-9.9 22.1-22.1 22.1H22.1C9.9 222 0 212.1 0 199.9V22.1z" fill="#635BFF"/>
            <path d="M224.4 88.6c0-4.1 3.4-5.7 9-5.7 8 0 18.2 2.4 26.2 6.7V63.7c-8.8-3.5-17.5-4.9-26.2-4.9-21.4 0-35.7 11.2-35.7 29.9 0 29.2 40.2 24.5 40.2 37.1 0 4.8-4.2 6.4-10.1 6.4-8.7 0-19.8-3.6-28.6-8.4v26.3c9.7 4.2 19.5 5.9 28.6 5.9 21.8 0 36.8-10.8 36.8-29.7-.1-31.5-40.2-25.9-40.2-37.7zM290 42.6l-26.8 5.7v21.5h-14.7v22.8h14.7v42.8c0 18.9 13.7 26.1 32.6 26.1 8 0 15.7-1.4 21-4.2v-22.5c-3.8 1.9-11.8 3.6-17.2 3.6-6.5 0-9.6-2.4-9.6-9.3V92.6h26.8V69.8H290V42.6zM339.4 78.5l-1.5-8.7h-24.1v89.7h27.8v-56.2c7.3-9.6 19.6-7.8 23.4-6.5V69.4c-4-1.4-18.3-4-25.6 9.1zM393.5 59.3c-8.9 0-14.7 5.8-14.7 14.5 0 8.6 5.8 14.5 14.7 14.5 8.9 0 14.7-5.9 14.7-14.5 0-8.7-5.8-14.5-14.7-14.5zm-13.9 100.2h27.8V69.8h-27.8v89.7zM131.7 113c0 15.2 10.4 25.6 23.9 25.6 13.6 0 22.1-7.9 24.4-19.7H153c-1.3 5-3.8 8-7.8 8-5.3 0-8.3-3.6-8.8-10.1h44.3c.2-2.1.3-4.2.3-6.2 0-22.8-12.5-35.6-31.2-35.6-18.6 0-29.4 12.3-29.4 29.3l-.1.1-.1.1.2 8.5zm12.3-11.8c1.3-6.2 4.7-10 9.3-10 5.2 0 8.3 3.7 8.6 10h-17.9zM108.3 78.1c-4.4-1.9-13.5-3.5-21.2 0-8.7 4-13.6 12.3-13.6 22.4v59h27.8v-55.4c0-6.4 4.2-10.1 9.4-10.1 2.9 0 5.3.8 7.1 2.2l.5-18.1z" fill="white"/>
          </svg>
        </div>
        <div class="stripe-block__chips">
          <span class="stripe-chip">🔒 SSL 256-bit</span>
          <span class="stripe-chip">✓ PCI DSS Nivel 1</span>
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
    .card-logos { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-bottom: var(--sp-4); }
    .card-logo-chip {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-3); border-radius: var(--r-lg);
      background: var(--c-raised); border: 1px solid var(--b-2);
      font-size: var(--f-xs); color: var(--t-300); font-weight: var(--w-5);
    }
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
  abrirPortalStripe(): void {
    alert('La gestión de tarjetas guardadas estará disponible próximamente. Los pagos se completan de forma segura en cada reserva mediante Stripe Checkout.');
  }
}
