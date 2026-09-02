import { Component, OnInit, HostListener, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsPhoneInputComponent } from '../../shared/components/phone-input/rs-phone-input.component';
import { PERMISO_ADMIN_DESCRIPCIONES, PERMISO_ADMIN_LABELS, PermisoAdmin, nombreAlphaPresentacion } from 'shared';
import { AdminApiService, UsuarioAdmin, ResumenUsuarios, FichaUsuario, CrearUsuarioDto, ActualizarUsuarioDto } from './admin-api.service';
import { conFecha, descargarCsv } from '../../shared/exportacion/csv';

import { EurosPipe } from '../../shared/pipes/euros.pipe';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
const ROL_BADGE: Record<string, string> = {
  cliente: 'rs-badge--neutral',
  comercio_admin: 'rs-badge--accent',
  comercio_staff: 'rs-badge--accent',
  admin: 'rs-badge--error',
};

const ROL_LABEL: Record<string, string> = {
  cliente: 'Cliente',
  comercio_admin: 'Admin comercio',
  comercio_staff: 'Staff comercio',
  admin: 'Admin plataforma',
};

const FILTROS_ROL = [
  { label: 'Todos', valor: '' },
  { label: 'Clientes', valor: 'cliente' },
  { label: 'Admin comercio', valor: 'comercio_admin' },
  { label: 'Admins', valor: 'admin' },
] as const;

const LIMITE = 20;

/** Etiqueta del rol, también fuera de la plantilla (para el CSV). */
function labelRolDe(rol: string): string {
  return ROL_LABEL[rol] ?? rol;
}

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [
    TraducirPipe, DatePipe, ReactiveFormsModule, RsPhoneInputComponent, RsIconComponent, EurosPipe
  ],
  template: `
    <!-- Cabecera -->
    <div class="rs-page-header">
      <div>
        <h1 class="rs-page-title">{{ 'Usuarios' | t }}</h1>
        <p class="rs-page-sub">{{ 'Usuarios registrados en la plataforma.' | t }}</p>
      </div>
      <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap">
        <button class="rs-btn rs-btn--secondary rs-btn--sm" (click)="exportarCsv()">
          <rs-icon name="download" [size]="14" [stroke]="2"></rs-icon> {{ 'Exportar CSV' | t }}
        </button>
        <button class="rs-btn rs-btn--primary rs-btn--sm" (click)="abrirCrear()">{{ '+ Nuevo usuario' | t }}</button>
      </div>
    </div>

    <!-- Resumen superior: un solo "5 Total" no decía nada (TCK-8035) -->
    <div class="resumen-usuarios">
      <div class="rs-card resumen-tile">
        <span class="resumen-tile__num">{{ resumen()?.total ?? total() }}</span>
        <span class="resumen-tile__lbl">{{ 'Usuarios totales' | t }}</span>
      </div>
      <div class="rs-card resumen-tile">
        <span class="resumen-tile__num">{{ resumen()?.clientes ?? '—' }}</span>
        <span class="resumen-tile__lbl">{{ 'Clientes' | t }}</span>
      </div>
      <div class="rs-card resumen-tile">
        <span class="resumen-tile__num">{{ resumen()?.comercios ?? '—' }}</span>
        <span class="resumen-tile__lbl">{{ 'Usuarios de comercios' | t }}</span>
      </div>
      <div class="rs-card resumen-tile">
        <span class="resumen-tile__num">{{ resumen()?.administradores ?? '—' }}</span>
        <span class="resumen-tile__lbl">{{ 'Administradores Doogking' | t }}</span>
      </div>
      <div class="rs-card resumen-tile">
        <span class="resumen-tile__num">{{ resumen()?.nuevosMes ?? '—' }}</span>
        <span class="resumen-tile__lbl">{{ 'Nuevos este mes' | t }}</span>
      </div>
    </div>

    <!-- Barra de filtros + búsqueda -->
    <div class="rs-toolbar">
      <div class="rs-toolbar__grupo">
        @for (f of filtros; track f.valor) {
          <button
            class="rs-btn rs-btn--sm"
            [class.rs-btn--primary]="filtroRol() === f.valor"
            [class.rs-btn--ghost]="filtroRol() !== f.valor"
            (click)="setFiltro(f.valor)">
            {{ f.label | t }}
          </button>
        }
      </div>
      <div class="rs-toolbar__campo rs-toolbar__campo--buscador">
        <label class="rs-toolbar__lbl" for="fu-buscar">{{ 'Buscar' | t }}</label>
        <input id="fu-buscar" class="rs-inp rs-toolbar__control" type="text"
               [placeholder]="'Nombre o email…' | t"
               [value]="buscar()" (input)="onBuscar($event)" />
      </div>

      <!-- Filtro por verificación (TCK-8035 §2) -->
      <div class="rs-toolbar__campo">
        <label class="rs-toolbar__lbl" for="fu-verificado">{{ 'Verificación' | t }}</label>
        <select id="fu-verificado" class="rs-inp rs-toolbar__control" [value]="filtroVerificado()"
                (change)="setVerificado($any($event.target).value)">
          <option value="">{{ 'Todos' | t }}</option>
          <option value="true">{{ 'Solo verificados' | t }}</option>
          <option value="false">{{ 'Solo sin verificar' | t }}</option>
        </select>
      </div>
    </div>

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ errorMsg() }}</div>
    }

    <!-- Tabla -->
    <!-- Sin overflow:hidden: recortaba el desplegable de acciones, que se
         desborda de la tarjeta a propósito. Las esquinas se redondean en la
         cabecera y en la última fila (ver .tbl-head / .tbl-row:last-child). -->
    <div class="rs-card tbl-card" style="padding:0">
      <div class="tbl-head">
        <span>{{ 'Usuario' | t }}</span>
        <span>{{ 'Email' | t }}</span>
        <span>{{ 'Rol' | t }}</span>
        <span>{{ 'Verificación' | t }}</span>
        <span>Alpha</span>
        <span>{{ 'Reservas' | t }}</span>
        <span>{{ 'Registro' | t }}</span>
        <span>{{ 'Acciones' | t }}</span>
      </div>

      @if (cargando()) {
        @for (i of [1,2,3,4,5]; track i) {
          <div class="tbl-row tbl-skeleton">
            <div class="skel skel--lg"></div>
            <div class="skel skel--xl"></div>
            <div class="skel skel--md"></div>
            <div class="skel skel--sm"></div>
            <div class="skel skel--sm"></div>
            <div class="skel skel--md"></div>
          </div>
        }
      } @else {
        @for (u of usuarios(); track u._id) {
          <div class="tbl-row">
            <div class="usuario-cell">
              <div class="avatar">{{ u.nombre[0]?.toUpperCase() ?? 'U' }}</div>
              <span class="cell-primary">{{ u.nombre }}</span>
            </div>
            <span class="cell-email" data-col="Email">{{ u.email }}</span>
            <span data-col="Rol">
              <span class="rs-badge {{ badgeRol(u.rol) }}">{{ labelRol(u.rol) }}</span>
            </span>
            <span data-col="Verificado">
              @if (u.verificado) {
                <span class="rs-badge rs-badge--success">
                  <rs-icon name="check" [size]="12" [stroke]="3"></rs-icon> {{ 'Verificado' | t }}
                </span>
              } @else {
                <span class="rs-badge rs-badge--neutral">{{ 'Pendiente' | t }}</span>
              }
            </span>
            <!-- Alpha sólo aplica a clientes; el resto muestra "—" (TCK-8035) -->
            <span data-col="Alpha">
              @if (esCliente(u)) {
                <span class="rs-badge rs-badge--warning">
                  <rs-icon name="crown" [size]="12" [stroke]="2"></rs-icon> {{ nombreAlpha(u) }}
                </span>
              } @else {
                <span class="cell-muted">—</span>
              }
            </span>
            <span class="cell-muted" data-col="Reservas">{{ esCliente(u) ? (u.reservas ?? 0) : '—' }}</span>
            <span class="cell-muted" data-col="Registro">{{ u.createdAt | date:'d MMM yyyy' }}</span>
            <!-- Acciones dentro de ⋯ para no dejar la papelera al descubierto (TCK-8035 §8) -->
            <div class="acciones" (click)="$event.stopPropagation()">
              <button class="rs-btn rs-btn--ghost rs-btn--sm" [attr.aria-label]="'Acciones' | t"
                      (click)="menuAbiertoId.set(menuAbiertoId() === u._id ? null : u._id)">
                <rs-icon name="more-horizontal" [size]="15" [stroke]="2"></rs-icon>
              </button>
              @if (menuAbiertoId() === u._id) {
                <div class="acciones__menu">
                  <button class="acciones__item" (click)="abrirFicha(u)">
                    <rs-icon name="eye" [size]="13" [stroke]="2"></rs-icon> {{ 'Ver ficha' | t }}
                  </button>
                  <button class="acciones__item" (click)="abrirEditar(u)">
                    <rs-icon name="pencil" [size]="13" [stroke]="2"></rs-icon> {{ 'Editar' | t }}
                  </button>
                  <button class="acciones__item acciones__item--danger" (click)="confirmarEliminar(u)">
                    <rs-icon name="trash" [size]="13" [stroke]="2"></rs-icon> {{ 'Eliminar usuario' | t }}
                  </button>
                </div>
              }
            </div>
          </div>
        }
        @if (usuarios().length === 0) {
          <div class="empty-state">
            <span class="empty-icon"><rs-icon name="users" [size]="34" [stroke]="1.5"></rs-icon></span>
            <p>No hay usuarios{{ filtroRol() ? ' con rol "' + filtroRol() + '"' : '' }}</p>
          </div>
        }
      }
    </div>

    <!-- Paginación -->
    @if (totalPaginas() > 1) {
      <div class="pagination">
        <button class="rs-btn rs-btn--secondary rs-btn--sm"
          [disabled]="paginaActual() <= 1" (click)="cambiarPagina(paginaActual() - 1)">{{ '← Anterior' | t }}</button>
        <span class="page-info">Página {{ paginaActual() }} de {{ totalPaginas() }} · {{ total() }} usuarios</span>
        <button class="rs-btn rs-btn--secondary rs-btn--sm"
          [disabled]="paginaActual() >= totalPaginas()" (click)="cambiarPagina(paginaActual() + 1)">{{ 'Siguiente →' | t }}</button>
      </div>
    }

<!-- MODAL CREAR / EDITAR -->
@if (modalVisible()) {
  <div class="overlay" (click)="cerrarModal()">
    <div class="modal rs-card" (click)="$event.stopPropagation()">
      <h2 class="modal-title">{{ editandoId() ? 'Editar usuario' : 'Nuevo usuario' }}</h2>

      <form [formGroup]="form" (ngSubmit)="guardar()">
        <div class="form-row">
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Nombre *' | t }}</label>
            <input formControlName="nombre" class="rs-input" [placeholder]="'Juan Pérez' | t" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Email *' | t }}</label>
            <input formControlName="email" type="email" class="rs-input" placeholder="juan@example.com" />
          </div>
        </div>

        @if (!editandoId()) {
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Contraseña *' | t }}</label>
            <input formControlName="password" type="password" class="rs-input" [placeholder]="'Mínimo 6 caracteres' | t" />
          </div>
        }

        <div class="form-row">
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Teléfono' | t }}</label>
            <rs-phone-input formControlName="telefono" [etiqueta]="'Teléfono del usuario' | t" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Rol' | t }}</label>
            <select formControlName="rol" class="rs-input">
              <option value="cliente">{{ 'Cliente' | t }}</option>
              <option value="comercio_admin">{{ 'Admin comercio' | t }}</option>
              <option value="comercio_staff">{{ 'Staff comercio' | t }}</option>
              <option value="admin">{{ 'Admin plataforma' | t }}</option>
            </select>
          </div>
        </div>

        @if (esRolComercio()) {
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Comercio asociado' | t }}</label>
            <select formControlName="comercioId" class="rs-input">
              <option value="">{{ '— Selecciona un comercio —' | t }}</option>
              @for (c of comercios(); track c._id) {
                <option [value]="c._id">{{ c.nombreComercial }}</option>
              }
            </select>
            <p class="rs-field-hint" style="font-size:var(--f-xs);color:var(--t-400);margin-top:var(--sp-1)">
              {{ 'Obligatorio para cuentas de comercio; sin él no podrán ver sus listados ni reservas.' | t }}
            </p>
          </div>
        }

        <!-- Permisos internos: una persona de soporte no debería poder tocar
             comisiones ni liquidaciones (TCK-8040 §7). -->
        @if (esRolAdmin()) {
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Acceso del administrador' | t }}</label>
            <div class="permisos">
              @for (p of permisosDisponibles; track p.valor) {
                <label class="permiso">
                  <input type="checkbox" [checked]="tienePermiso(p.valor)"
                         (change)="alternarPermiso(p.valor)" />
                  <span>
                    <strong>{{ p.label | t }}</strong>
                    <em>{{ p.descripcion }}</em>
                  </span>
                </label>
              }
            </div>
            <p class="rs-field-hint" style="font-size:var(--f-xs);color:var(--t-400);margin-top:var(--sp-2)">
              {{ 'Sin marcar nada, la cuenta es superadministradora y ve todo el panel.' | t }}
            </p>
          </div>
        }

        @if (editandoId()) {
          <div class="rs-form-group">
            <label class="check-item" style="cursor:pointer">
              <input type="checkbox" formControlName="verificado" style="accent-color:var(--c-accent);width:20px;height:20px" />
              <span style="font-size:var(--f-sm);color:var(--t-200)">{{ 'Cuenta verificada' | t }}</span>
            </label>
          </div>
        }

        @if (modalError()) {
          <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ modalError() }}</div>
        }

        <div class="modal-actions">
          <button type="button" class="rs-btn rs-btn--ghost" (click)="cerrarModal()">{{ 'Cancelar' | t }}</button>
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="form.invalid || guardando()">
            {{ guardando() ? 'Guardando…' : (editandoId() ? 'Guardar cambios' : 'Crear usuario') }}
          </button>
        </div>
      </form>
    </div>
  </div>
}

<!-- MODAL CONFIRMAR ELIMINAR -->
<!-- Ficha administrativa completa (TCK-8035 §5 y §6) -->
@if (fichaAbierta()) {
  <div class="modal-backdrop" (click)="cerrarFicha()">
    <div class="ficha" (click)="$event.stopPropagation()">
      @if (cargandoFicha()) {
        <p style="color:var(--t-400)">{{ 'Cargando la ficha…' | t }}</p>
      } @else if (ficha(); as f) {
        <div class="ficha__cabecera">
          <div>
            <h3 class="ficha__nombre">{{ f.usuario.nombre }}</h3>
            <p class="ficha__meta">
              {{ f.usuario.email }}
              @if (f.usuario.telefono) { · {{ f.usuario.telefono }} }
              · {{ labelRol(f.usuario.rol) }}
              @if (f.usuario.createdAt) { · alta {{ f.usuario.createdAt | date:'d MMM yyyy' }} }
            </p>
          </div>
          <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cerrarFicha()">{{ 'Cerrar' | t }}</button>
        </div>

        <div class="ficha__kpis">
          <div class="ficha__kpi"><strong>{{ f.resumen.totalReservas }}</strong><span>{{ 'Reservas' | t }}</span></div>
          <div class="ficha__kpi"><strong>{{ f.resumen.canceladas }}</strong><span>{{ 'Canceladas' | t }}</span></div>
          <div class="ficha__kpi"><strong>{{ f.resumen.totalGastado | euros:'1.0-0' }}</strong><span>{{ 'Gastado' | t }}</span></div>
          <div class="ficha__kpi"><strong>{{ f.resumen.resenas }}</strong><span>{{ 'Reseñas' | t }}</span></div>
          <div class="ficha__kpi"><strong>{{ f.resumen.incidencias }}</strong><span>{{ 'Incidencias' | t }}</span></div>
        </div>

        @if (f.comercio) {
          <div class="ficha__bloque">
            <h4>{{ 'Comercio asociado' | t }}</h4>
            <p>{{ f.comercio.nombreComercial }} · {{ f.comercio.estado }} · plan {{ f.comercio.plan }}</p>
          </div>
        }

        @if (f.usuario.rol === 'admin') {
          <div class="ficha__bloque">
            <h4>{{ 'Acceso al panel' | t }}</h4>
            <p>
              {{ f.usuario.permisosAdmin.length
                 ? f.usuario.permisosAdmin.join(' · ')
                 : 'Superadministrador (acceso completo)' }}
            </p>
          </div>
        }

        @if (f.mascotas.length) {
          <div class="ficha__bloque">
            <h4>{{ 'Mascotas' | t }}</h4>
            <p>@for (m of f.mascotas; track m.nombre) { {{ m.nombre }}@if (m.raza) { ({{ m.raza }}) }{{ $last ? '' : ' · ' }} }</p>
          </div>
        }

        <div class="ficha__bloque">
          <h4>{{ 'Últimas reservas' | t }}</h4>
          @if (f.reservas.length) {
            <ul class="ficha__reservas">
              @for (r of f.reservas; track r._id) {
                <li>
                  <code>{{ r.codigo }}</code>
                  <span>{{ r.vertical }} · {{ (r.fechaInicio || r.createdAt) | date:'d MMM yyyy' }}</span>
                  <span>{{ r.montoTotal | euros:'1.2-2' }}</span>
                  <span class="rs-badge rs-badge--neutral">{{ r.estado }}</span>
                </li>
              }
            </ul>
          } @else {
            <p style="color:var(--t-400)">{{ 'Sin reservas todavía.' | t }}</p>
          }
        </div>
      } @else {
        <p class="rs-alert rs-alert--error">{{ 'No se pudo cargar la ficha.' | t }}</p>
      }
    </div>
  </div>
}

@if (eliminarUsuario()) {
  <div class="overlay" (click)="cancelarEliminar()">
    <div class="modal modal--sm rs-card" (click)="$event.stopPropagation()">
      <h2 class="modal-title">{{ 'Eliminar usuario' | t }}</h2>
      <p style="color:var(--t-300);margin-bottom:var(--sp-5)">
        {{ '¿Estás seguro de que quieres eliminar a' | t }}
        <strong style="color:var(--t-100)">{{ eliminarUsuario()!.nombre }}</strong>
        ({{ eliminarUsuario()!.email }})?
        Esta acción no se puede deshacer.
      </p>
      @if (modalError()) {
        <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ modalError() }}</div>
      }
      <div class="modal-actions">
        <button class="rs-btn rs-btn--ghost" (click)="cancelarEliminar()">{{ 'Cancelar' | t }}</button>
        <button class="rs-btn rs-btn--danger" [disabled]="guardando()" (click)="ejecutarEliminar()">
          {{ guardando() ? 'Eliminando…' : 'Eliminar' }}
        </button>
      </div>
    </div>
  </div>
}
  `,
  styles: [`
    :host { display: contents; }

    .page-kpi { padding: var(--sp-4) var(--sp-6); text-align: center; min-width: 100px; }
    .kpi-num { display: block; font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); }
    .kpi-lbl { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }

    .resumen-usuarios { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--sp-3); margin-bottom: var(--sp-4); }
    .resumen-tile { padding: var(--sp-4) var(--sp-5); display: flex; flex-direction: column; gap: 2px; }
    .resumen-tile__num { font-family: var(--font-accent); font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); line-height: 1.1; }
    .resumen-tile__lbl { font-size: var(--f-xs); color: var(--t-400); }

    .modal-backdrop {
      position: fixed; inset: 0; z-index: var(--z-4, 100);
      background: rgba(0,19,93,.35); display: flex; align-items: center; justify-content: center;
      padding: var(--sp-5);
    }
    .ficha {
      width: 100%; max-width: 720px; max-height: 86vh; overflow-y: auto;
      padding: var(--sp-6); background: var(--c-card); border-radius: var(--r-xl);
      box-shadow: var(--shadow-lg, 0 12px 32px rgba(8,37,139,.18));
      display: flex; flex-direction: column; gap: var(--sp-5);
    }
    .ficha__cabecera { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--sp-4); }
    .ficha__nombre { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); }
    .ficha__meta { font-size: var(--f-sm); color: var(--t-400); }
    .ficha__kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: var(--sp-3); }
    .ficha__kpi { padding: var(--sp-3); background: var(--c-raised); border-radius: var(--r-lg); display: flex; flex-direction: column; }
    .ficha__kpi strong { font-family: var(--font-accent); font-size: var(--f-lg); color: var(--t-100); }
    .ficha__kpi span { font-size: var(--f-xs); color: var(--t-400); }
    .ficha__bloque h4 { font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-2); }
    .ficha__bloque p { font-size: var(--f-sm); color: var(--t-300); }
    .ficha__reservas { display: flex; flex-direction: column; gap: var(--sp-2); list-style: none; }
    .ficha__reservas li { display: flex; flex-wrap: wrap; gap: var(--sp-3); align-items: center; font-size: var(--f-sm); color: var(--t-300); }
    .ficha__reservas code { font-family: monospace; font-size: var(--f-xs); color: var(--c-accent); }

    .permisos { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--sp-2); }
    .permiso {
      display: flex; align-items: flex-start; gap: var(--sp-2);
      padding: var(--sp-3); cursor: pointer;
      background: var(--c-raised); border-radius: var(--r-lg);
    }
    .permiso span { display: flex; flex-direction: column; gap: 2px; }
    .permiso strong { font-size: var(--f-sm); color: var(--t-100); }
    .permiso em { font-size: var(--f-xs); color: var(--t-400); font-style: normal; }

    .acciones { position: relative; }
    .acciones__menu {
      position: absolute; right: 0; top: calc(100% + 4px); z-index: var(--z-2);
      min-width: 190px; padding: var(--sp-2);
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-lg);
      box-shadow: var(--shadow-lg, 0 12px 32px rgba(8,37,139,.12));
    }
    .acciones__item {
      display: flex; align-items: center; gap: var(--sp-2); width: 100%;
      padding: var(--sp-2) var(--sp-3); border: none; background: transparent;
      border-radius: var(--r-md); cursor: pointer; text-align: left;
      font-size: var(--f-sm); color: var(--t-200);
      &:hover { background: var(--c-raised); }
    }
    .acciones__item--danger { color: var(--c-red, #B91C1C); }

    /*
     * La tarjeta no recorta su contenido para que el menú de acciones pueda
     * salirse; a cambio, las esquinas redondeadas se aplican aquí, en la primera
     * y la última fila, que es donde tocan el borde.
     */
    .tbl-card { overflow: visible; }
    .tbl-head { display: grid; grid-template-columns: 1.1fr 1.3fr 150px 130px 130px 90px 110px 70px; padding: var(--sp-3) var(--sp-5); font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--b-1); background: var(--c-raised); border-radius: var(--r-2xl) var(--r-2xl) 0 0; }
    .tbl-row { display: grid; grid-template-columns: 1.1fr 1.3fr 150px 130px 130px 90px 110px 70px; padding: var(--sp-4) var(--sp-5); align-items: center; border-bottom: 1px solid var(--b-1); transition: background .15s; }
    .tbl-row:last-child { border: none; border-radius: 0 0 var(--r-2xl) var(--r-2xl); }
    .tbl-row:hover { background: var(--c-raised); }

    /*
     * Móvil: una tabla de 6 columnas no se puede leer en 390px ni estrechando
     * ni con scroll lateral, así que deja de ser tabla. Cada fila se convierte
     * en una tarjeta y cada celda muestra su etiqueta (data-col) junto al dato.
     */
    @media (max-width: 768px) {
      .tbl-head { display: none; }

      .tbl-row {
        grid-template-columns: 1fr;
        gap: var(--sp-2);
        padding: var(--sp-4) var(--sp-5);
        border-bottom: 6px solid var(--c-base);
      }

      .tbl-row > [data-col] {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--sp-4);
        /* Un email o una razón social larga parte de línea en vez de desbordar. */
        overflow-wrap: anywhere;
        text-align: right;
      }

      .tbl-row > [data-col]::before {
        content: attr(data-col);
        flex: 0 0 auto;
        font-family: var(--font-accent);
        font-size: var(--f-xs);
        font-weight: var(--w-7);
        letter-spacing: .06em;
        text-transform: uppercase;
        color: var(--t-400);
      }
    }

    .tbl-skeleton { pointer-events: none; }

    .usuario-cell { display: flex; align-items: center; gap: var(--sp-3); }
    .avatar { width: 32px; height: 32px; border-radius: var(--r-full); background: var(--c-accent-lo); border: 1px solid var(--b-a); display: flex; align-items: center; justify-content: center; font-size: var(--f-xs); font-weight: var(--w-7); color: var(--c-accent); flex-shrink: 0; }
    .cell-primary { font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-100); }
    .cell-email { font-size: var(--f-sm); color: var(--t-300); word-break: break-all; }
    .cell-muted { font-size: var(--f-xs); color: var(--t-400); }
    .acciones { display: flex; gap: var(--sp-2); flex-wrap: wrap; align-items: center; }

    /*
     * Móvil: las acciones son el pie de la tarjeta, no una celda más. Se alinean
     * a la izquierda tras un separador y los botones con texto reparten el ancho;
     * los de solo icono se quedan cuadrados al final en vez de estirarse.
     */
    @media (max-width: 768px) {
      .acciones {
        justify-content: flex-start;
        gap: var(--sp-2);
        margin-top: var(--sp-1);
        padding-top: var(--sp-3);
        border-top: 1px solid var(--b-1);
      }

      .acciones .rs-btn {
        /* Dos botones con texto por fila: repartir "auto" dejaba filas huérfanas. */
        flex: 1 1 calc(50% - var(--sp-2));
        justify-content: center;
        white-space: nowrap;
      }

      .acciones [data-icono] {
        flex: 0 0 44px;
        padding-inline: 0;
      }
    }

    .skel { background: var(--c-raised); border-radius: var(--r-sm); height: 14px; animation: pulse 1.4s ease-in-out infinite; }
    .skel--sm { width: 80px; } .skel--md { width: 120px; } .skel--lg { width: 150px; } .skel--xl { width: 200px; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.45; } }

    .empty-state { padding: var(--sp-16); text-align: center; color: var(--t-400); }
    .empty-icon { font-size: 2.5rem; display: block; margin-bottom: var(--sp-3); }

    .pagination { display: flex; align-items: center; justify-content: center; gap: var(--sp-4); margin-top: var(--sp-6); }
    .page-info { font-size: var(--f-sm); color: var(--t-400); }

    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: var(--sp-4); }
    .modal { width: 100%; max-width: 580px; padding: var(--sp-8); max-height: 90vh; overflow-y: auto; }
    .modal--sm { max-width: 420px; }
    .modal-title { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-6); }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); }
    @media (max-width: 540px) { .form-row { grid-template-columns: 1fr; } }
    .modal-actions { display: flex; gap: var(--sp-3); justify-content: flex-end; margin-top: var(--sp-6); }
  `],
})
export class AdminUsuariosComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly buscarSubject = new Subject<string>();

  readonly cargando = signal(true);
  readonly usuarios = signal<UsuarioAdmin[]>([]);
  readonly total = signal(0);
  readonly paginaActual = signal(1);
  readonly filtroRol = signal('');
  readonly buscar = signal('');
  readonly errorMsg = signal('');

  /** Cabecera, filtro de verificación y menú de acciones (TCK-8035). */
  readonly resumen = signal<ResumenUsuarios | null>(null);
  readonly filtroVerificado = signal('');
  readonly menuAbiertoId = signal<string | null>(null);
  readonly fichaAbierta = signal(false);
  readonly cargandoFicha = signal(false);
  readonly ficha = signal<FichaUsuario | null>(null);

  readonly modalVisible = signal(false);
  readonly editandoId = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly modalError = signal('');
  readonly eliminarUsuario = signal<UsuarioAdmin | null>(null);

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / LIMITE)));
  readonly filtros = FILTROS_ROL;

  readonly form = this.fb.group({
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.minLength(6)],
    telefono: [''],
    rol: ['cliente'],
    comercioId: [''],
    verificado: [false],
  });

  readonly comercios = signal<Array<{ _id: string; nombreComercial: string }>>([]);

  /** Áreas marcadas para este administrador; vacío = acceso total. */
  readonly permisosDisponibles = Object.values(PermisoAdmin).map((valor) => ({
    valor,
    label: PERMISO_ADMIN_LABELS[valor],
    descripcion: PERMISO_ADMIN_DESCRIPCIONES[valor],
  }));
  readonly permisosSeleccionados = signal<string[]>([]);

  async abrirFicha(u: UsuarioAdmin): Promise<void> {
    this.fichaAbierta.set(true);
    this.cargandoFicha.set(true);
    this.ficha.set(null);
    try {
      this.ficha.set(await firstValueFrom(this.adminApi.getFichaUsuario(u._id)));
    } catch {
      this.ficha.set(null);
    } finally {
      this.cargandoFicha.set(false);
    }
  }

  cerrarFicha(): void {
    this.fichaAbierta.set(false);
    this.ficha.set(null);
  }

  /**
   * Exporta lo que hay en pantalla. No se descargan todos los usuarios de la
   * base: lo que ves filtrado es lo que te llevas, que es lo que se espera y
   * evita volcar miles de filas sin querer (TCK-8035).
   */
  exportarCsv(): void {
    const cabecera = ['Nombre', 'Email', 'Rol', 'Verificado', 'Alpha', 'Reservas', 'Alta'];
    const filas = this.usuarios().map((u) => [
      u.nombre,
      u.email,
      labelRolDe(u.rol),
      u.verificado ? 'Sí' : 'No',
      this.esCliente(u) ? this.nombreAlpha(u) : '—',
      this.esCliente(u) ? String(u.reservas ?? 0) : '—',
      new Date(u.createdAt).toLocaleDateString('es-ES'),
    ]);

    descargarCsv([cabecera, ...filas], conFecha('usuarios-doogking'));
  }

  esRolAdmin(): boolean {
    return this.form.controls.rol.value === 'admin';
  }

  tienePermiso(permiso: string): boolean {
    return this.permisosSeleccionados().includes(permiso);
  }

  alternarPermiso(permiso: string): void {
    this.permisosSeleccionados.update((lista) =>
      lista.includes(permiso) ? lista.filter((p) => p !== permiso) : [...lista, permiso],
    );
  }

  esRolComercio(): boolean {
    const rol = this.form.controls.rol.value;
    return rol === 'comercio_admin' || rol === 'comercio_staff';
  }

  constructor() {
    this.buscarSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(valor => {
      this.buscar.set(valor);
      this.paginaActual.set(1);
      void this.cargar();
    });
  }

  /** El menú ⋯ se cierra al pulsar fuera. */
  @HostListener('document:click')
  cerrarMenu(): void {
    this.menuAbiertoId.set(null);
  }

  esCliente(u: UsuarioAdmin): boolean {
    return u.rol === 'cliente';
  }

  /** Nivel Alpha en romanos aunque la BD guarde el formato antiguo (TCK-8011). */
  nombreAlpha(u: UsuarioAdmin): string {
    if (!u.nivelAlpha) return 'ALPHA I';
    return nombreAlphaPresentacion(u.nivelAlpha, 1);
  }

  setVerificado(valor: string): void {
    this.filtroVerificado.set(valor);
    this.paginaActual.set(1);
    void this.cargar();
  }

  async ngOnInit(): Promise<void> {
    await this.cargar();
    try {
      this.resumen.set(await firstValueFrom(this.adminApi.getResumenUsuarios()));
    } catch {
      // Sin resumen la tabla sigue siendo utilizable: cae al total paginado.
    }
    try {
      const res = await firstValueFrom(this.adminApi.getComercios({ limite: 200 }));
      this.comercios.set(res.items.map((c) => ({ _id: c._id, nombreComercial: c.nombreComercial })));
    } catch {
      // Sin lista de comercios no se puede vincular, pero no bloquea el resto.
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorMsg.set('');
    try {
      const result = await firstValueFrom(this.adminApi.getUsuarios({
        page: this.paginaActual(),
        limite: LIMITE,
        rol: this.filtroRol() || undefined,
        buscar: this.buscar() || undefined,
        verificado: this.filtroVerificado() === '' ? undefined : this.filtroVerificado() === 'true',
      }));
      this.usuarios.set(result.items);
      this.total.set(result.total);
    } catch {
      this.errorMsg.set('Error cargando los usuarios.');
    } finally {
      this.cargando.set(false);
    }
  }

  async setFiltro(rol: string): Promise<void> {
    this.filtroRol.set(rol);
    this.paginaActual.set(1);
    await this.cargar();
  }

  onBuscar(event: Event): void {
    this.buscarSubject.next((event.target as HTMLInputElement).value);
  }

  async cambiarPagina(pagina: number): Promise<void> {
    this.paginaActual.set(pagina);
    await this.cargar();
  }

  abrirCrear(): void {
    this.editandoId.set(null);
    this.form.reset({ rol: 'cliente', verificado: false });
    this.form.get('password')!.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.get('password')!.updateValueAndValidity();
    this.modalError.set('');
    this.modalVisible.set(true);
  }

  abrirEditar(u: UsuarioAdmin): void {
    this.editandoId.set(u._id);
    this.form.patchValue({
      nombre: u.nombre,
      email: u.email,
      telefono: u.telefono ?? '',
      rol: u.rol,
      comercioId: u.comercioId ?? '',
      verificado: u.verificado,
    });
    this.permisosSeleccionados.set(u.permisosAdmin ?? []);
    this.form.get('password')!.clearValidators();
    this.form.get('password')!.updateValueAndValidity();
    this.modalError.set('');
    this.modalVisible.set(true);
  }

  cerrarModal(): void {
    this.modalVisible.set(false);
    this.editandoId.set(null);
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.modalError.set('');
    const v = this.form.value;
    try {
      const comercioId = this.esRolComercio() ? (v.comercioId || undefined) : undefined;
      if (this.esRolComercio() && !comercioId) {
        this.modalError.set('Selecciona el comercio asociado para una cuenta de comercio.');
        this.guardando.set(false);
        return;
      }
      if (this.editandoId()) {
        const dto: ActualizarUsuarioDto = {
          nombre: v.nombre!,
          email: v.email!,
          telefono: v.telefono || undefined,
          rol: v.rol!,
          verificado: v.verificado ?? false,
          comercioId,
          permisosAdmin: this.esRolAdmin() ? this.permisosSeleccionados() : [],
        };
        await firstValueFrom(this.adminApi.actualizarUsuario(this.editandoId()!, dto));
      } else {
        const dto: CrearUsuarioDto = {
          nombre: v.nombre!,
          email: v.email!,
          password: v.password!,
          telefono: v.telefono || undefined,
          rol: v.rol!,
          comercioId,
        };
        await firstValueFrom(this.adminApi.crearUsuario(dto));
      }
      this.cerrarModal();
      await this.cargar();
    } catch {
      this.modalError.set('Error guardando el usuario. Verifica que el email no esté en uso.');
    } finally {
      this.guardando.set(false);
    }
  }

  confirmarEliminar(u: UsuarioAdmin): void {
    this.eliminarUsuario.set(u);
    this.modalError.set('');
  }

  cancelarEliminar(): void {
    this.eliminarUsuario.set(null);
  }

  async ejecutarEliminar(): Promise<void> {
    const u = this.eliminarUsuario();
    if (!u) return;
    this.guardando.set(true);
    this.modalError.set('');
    try {
      await firstValueFrom(this.adminApi.eliminarUsuario(u._id));
      this.eliminarUsuario.set(null);
      await this.cargar();
    } catch {
      this.modalError.set('Error eliminando el usuario.');
    } finally {
      this.guardando.set(false);
    }
  }

  badgeRol(rol: string): string { return ROL_BADGE[rol] ?? 'rs-badge--neutral'; }
  labelRol(rol: string): string { return ROL_LABEL[rol] ?? rol; }
}
