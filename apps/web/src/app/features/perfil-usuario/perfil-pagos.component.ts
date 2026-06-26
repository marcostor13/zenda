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
    .accepted-note { font-size: var(--f-xs); color: var(--t-400); line-height: 1.6; }
  `],
})
export class PerfilPagosComponent {
  abrirPortalStripe(): void {
    alert('La gestión de tarjetas guardadas estará disponible próximamente. Los pagos se completan de forma segura en cada reserva mediante Stripe Checkout.');
  }
}
