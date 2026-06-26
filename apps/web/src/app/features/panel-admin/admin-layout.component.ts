import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';

const NAV_SECTIONS = [
  {
    title: 'Visión general',
    items: [
      { icon: 'sparkles',    label: 'Dashboard',  ruta: '/admin',           exact: true  },
      { icon: 'trending-up', label: 'Reportes',   ruta: '/admin/reportes',  exact: false },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { icon: 'building',    label: 'Comercios',  ruta: '/admin/comercios', exact: false },
      { icon: 'users',       label: 'Usuarios',   ruta: '/admin/usuarios',  exact: false },
      { icon: 'calendar',    label: 'Reservas',   ruta: '/admin/reservas',  exact: false },
    ],
  },
  {
    title: 'Plataforma',
    items: [
      { icon: 'tag',         label: 'Cupones',    ruta: '/admin/cupones',   exact: false },
    ],
  },
];

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, RsNavbarComponent, RsIconComponent],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="admin-layout">

    <!-- SIDEBAR -->
    <aside class="admin-sidebar">
      <div class="admin-sidebar__title">
        <span class="rs-badge rs-badge--danger">ADMIN</span>
        Panel de control
      </div>

      <nav>
        @for (section of navSections; track section.title) {
          <div class="nav-section">
            <div class="nav-section__title">{{ section.title }}</div>
            @for (item of section.items; track item.ruta) {
              <a
                [routerLink]="item.ruta"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.exact }"
                class="admin-nav-item">
                <rs-icon [name]="item.icon" [size]="16" [stroke]="2"></rs-icon>
                <span>{{ item.label }}</span>
              </a>
            }
          </div>
        }
      </nav>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="admin-main">
      <router-outlet />
    </main>

  </div>
</div>
  `,
  styles: [`
    :host { display: block; }

    .admin-layout {
      display: grid;
      grid-template-columns: 240px 1fr;
      min-height: calc(100vh - 64px);
    }
    @media (max-width: 1024px) {
      .admin-layout { grid-template-columns: 1fr; }
    }

    .admin-sidebar {
      background: var(--c-card);
      border-right: 1px solid var(--b-1);
      padding: var(--sp-6);
      position: sticky;
      top: 64px;
      height: calc(100vh - 64px);
      overflow-y: auto;
    }
    @media (max-width: 1024px) {
      .admin-sidebar { display: none; }
    }

    .admin-sidebar__title {
      font-size: var(--f-xs);
      color: var(--t-400);
      text-transform: uppercase;
      letter-spacing: .06em;
      margin-bottom: var(--sp-6);
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }

    .nav-section { margin-bottom: var(--sp-6); }
    .nav-section__title {
      font-size: var(--f-xs);
      color: var(--t-400);
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: var(--sp-2);
      padding: 0 var(--sp-4);
    }

    .admin-nav-item {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      border-radius: var(--r-lg);
      color: var(--t-300);
      font-size: var(--f-sm);
      text-decoration: none;
      transition: all .15s;
      margin-bottom: var(--sp-1);
    }
    .admin-nav-item:hover { background: var(--c-raised); color: var(--t-100); }
    .admin-nav-item.active { background: var(--c-accent-lo); color: var(--c-accent); }

    .admin-main {
      padding: var(--sp-8);
      display: flex;
      flex-direction: column;
      gap: var(--sp-6);
      min-width: 0;
    }
    @media (max-width: 768px) {
      .admin-main { padding: var(--sp-4); }
    }
  `],
})
export class AdminLayoutComponent {
  readonly navSections = NAV_SECTIONS;
}
