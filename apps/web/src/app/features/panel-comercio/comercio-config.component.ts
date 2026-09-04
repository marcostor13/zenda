import { Component, signal, computed, inject, DestroyRef, OnInit, WritableSignal } from '@angular/core';
import { AbstractControl, ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsPhoneInputComponent } from '../../shared/components/phone-input/rs-phone-input.component';
import { iconoVertical } from './vertical-icon';

import { ComercioApiService, MiComercio, ActualizarPerfilComercioPayload } from './comercio-api.service';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

/**
 * Pasos de la configuración del negocio.
 *
 * Ubicación y horarios **ya no están aquí**: cuelgan de cada servicio
 * (`/comercio/listados/:id/editar`). Un negocio puede tener la peluquería en el
 * centro abriendo de tarde y la residencia canina a las afueras con entradas
 * sólo por la mañana, y con una dirección y un horario de empresa la ficha
 * enseñaba al cliente datos que no eran los del servicio que iba a reservar.
 */
type TabConfig =
  | 'perfil' | 'contacto' | 'datosBancarios'
  | 'notificaciones' | 'verticales';

interface PasoConfig {
  readonly clave: TabConfig;
  readonly label: string;
  readonly icono: string;
}

/**
 * Orden del recorrido. Es también el orden en que los agrupa `FASES`: si los dos
 * se separaran, "Guardar y continuar" saltaría a un paso que el índice pinta en
 * otra fase (lo comprueba el test del recorrido).
 */
const TABS: ReadonlyArray<PasoConfig> = [
  { clave: 'perfil',         label: 'Perfil',            icono: 'building' },
  { clave: 'contacto',       label: 'Contacto',          icono: 'phone' },
  { clave: 'verticales',     label: 'Servicios que ofreces', icono: 'tag' },
  { clave: 'datosBancarios', label: 'Datos bancarios',   icono: 'euro' },
  { clave: 'notificaciones', label: 'Notificaciones',    icono: 'bell' },
];

/**
 * Una lista larga de pasos seguidos no la termina nadie. Se agrupan en tres fases
 * con nombre —el patrón de alta de anfitrión de Airbnb y del extranet de
 * Booking—: el comercio ve tres bloques cortos, no una fila de casillas.
 */
const FASES: ReadonlyArray<{
  readonly numero: number;
  readonly titulo: string;
  readonly resumen: string;
  readonly pasos: ReadonlyArray<PasoConfig>;
}> = [
  { numero: 1, titulo: 'Tu negocio',         resumen: 'Quién eres y cómo te contactan',
    pasos: ['perfil', 'contacto'] as TabConfig[] },
  { numero: 2, titulo: 'Cómo cobras',        resumen: 'Servicios y liquidaciones',
    pasos: ['verticales', 'datosBancarios'] as TabConfig[] },
  { numero: 3, titulo: 'Avisos',             resumen: 'Qué te notificamos',
    pasos: ['notificaciones'] as TabConfig[] },
].map((f) => ({
  ...f,
  pasos: f.pasos.map((clave) => TABS.find((t) => t.clave === clave) as PasoConfig),
}));


@Component({
  selector: 'app-comercio-config',
  standalone: true,
  imports: [
    TraducirPipe, ReactiveFormsModule,
    RsIconComponent, RsPhoneInputComponent,
  ],
  template: `
    <!-- Cabecera de la página -->
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ 'Configura tu negocio' | t }}</h1>
        <p class="page-sub">
          {{ 'Tres bloques cortos. Puedes guardar y seguir, o entrar directamente al dato que quieras cambiar.' | t }}
        </p>
      </div>
    </div>

    @if (guardado()) {
      <div class="rs-alert rs-alert--success">
        <rs-icon name="check-circle" [size]="18" [stroke]="2"></rs-icon>
        {{ 'Cambios guardados correctamente.' | t }}
      </div>
    }
    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
    }

    <div class="cfg">
      <!--
        Índice del recorrido. En escritorio es un raíl fijo a la izquierda, como
        el extranet de Booking; en móvil se pliega tras el paso actual, porque
        once entradas antes del formulario son una pantalla entera de scroll.
      -->
      <aside class="cfg__indice">
        <div class="cfg__resumen">
          <div class="cfg__resumen-head">
            <span class="cfg__resumen-pct">{{ progresoPerfil() }}%</span>
            <div>
              <p class="cfg__resumen-titulo">{{ 'Perfil completado' | t }}</p>
              <p class="cfg__resumen-sub">
                @if (faltantes().length === 1) {
                  Te falta 1 dato
                } @else if (faltantes().length) {
                  Te faltan {{ faltantes().length }} datos
                } @else {
                  Tu ficha está completa
                }
              </p>
              <p class="cfg__resumen-nota">{{ 'No hace falta el 100% para publicar' | t }}</p>
            </div>
          </div>
          <div class="cfg__barra" role="progressbar"
               [attr.aria-valuenow]="progresoPerfil()" [attr.aria-valuemin]="0" [attr.aria-valuemax]="100">
            <span [style.width.%]="progresoPerfil()"></span>
          </div>
        </div>

        <!-- Sólo móvil: abre el índice completo sin salir del paso. -->
        <button type="button" class="cfg__abrir" (click)="indiceAbierto.set(!indiceAbierto())"
                [attr.aria-expanded]="indiceAbierto()">
          <span class="cfg__abrir-txt">
            <strong>Paso {{ pasoActual() }} de {{ totalPasos }} · {{ faseActual().titulo }}</strong>
            <span class="cfg__abrir-paso">{{ pasoUi().label | t }}</span>
          </span>
          <rs-icon name="chevron-down" [size]="18" [stroke]="2"
                   class="cfg__abrir-chevron" [class.cfg__abrir-chevron--abierto]="indiceAbierto()"></rs-icon>
        </button>

        <div class="cfg__lista" [class.cfg__lista--abierta]="indiceAbierto()">
          @for (f of fases; track f.numero) {
            <div class="cfg__fase">
              <p class="cfg__fase-titulo">
                <span class="cfg__fase-num" [class.cfg__fase-num--ok]="faseCompleta(f)">
                  @if (faseCompleta(f)) {
                    <rs-icon name="check" [size]="12" [stroke]="3"></rs-icon>
                  } @else {
                    {{ f.numero }}
                  }
                </span>
                {{ f.titulo }}
              </p>
              <p class="cfg__fase-sub">{{ f.resumen }}</p>

              @for (p of f.pasos; track p.clave) {
                <button type="button" class="cfg__paso"
                        [class.cfg__paso--actual]="tab() === p.clave"
                        [attr.aria-current]="tab() === p.clave ? 'step' : null"
                        (click)="cambiarTab(p.clave)">
                  <span class="cfg__paso-estado"
                        [class.cfg__paso-estado--ok]="estadoSeccion(p.clave) === true"
                        [class.cfg__paso-estado--falta]="estadoSeccion(p.clave) === false">
                    @if (estadoSeccion(p.clave) === true) {
                      <rs-icon name="check" [size]="11" [stroke]="3"></rs-icon>
                    } @else {
                      <rs-icon [name]="p.icono" [size]="13" [stroke]="2"></rs-icon>
                    }
                  </span>
                  {{ p.label | t }}
                </button>
              }
            </div>
          }

          <!-- Lo que falta, accionable: cada carencia lleva a su paso (TCK-8028).
               Va dentro del índice para que en móvil no se interponga entre el
               paso actual y su formulario. -->
          @if (faltantes().length) {
            <div class="cfg__faltan">
              <p class="cfg__faltan-titulo">{{ 'Te falta por completar' | t }}</p>
              <div class="cfg__faltan-chips">
                @for (f of faltantes(); track f.label) {
                  <button type="button" class="cfg__chip" (click)="cambiarTab(f.tab)">
                    <rs-icon name="plus" [size]="11" [stroke]="2.5"></rs-icon> {{ f.label | t }}
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </aside>

      <div class="cfg__panel">
        <!-- Sólo escritorio: en móvil este dato ya está en el botón del índice. -->
        <p class="cfg__situacion">
          Fase {{ faseActual().numero }} de {{ fases.length }} · {{ faseActual().titulo }}
          <span class="cfg__situacion-sep">—</span>
          Paso {{ pasoActual() }} de {{ totalPasos }}
        </p>

        <!-- Aviso de cambios sin guardar: guardar por sección es cómodo hasta que
             te vas de pestaña y pierdes lo escrito (TCK-8028) -->
        @if (hayCambiosSinGuardar()) {
          <div class="rs-alert rs-alert--warning aviso-cambios">
            <rs-icon name="alert-circle" [size]="16" [stroke]="2"></rs-icon>
            {{ 'Tienes cambios sin guardar en este paso. Pulsa el botón de guardar antes de salir.' | t }}
          </div>
        }

    <!-- Información del negocio -->
@if (tab() === 'perfil') {
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(22,104,227,.12);color:var(--c-accent)">
          <rs-icon name="building" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">{{ 'Información del negocio' | t }}</h2>
          <p class="config-section__sub">{{ 'Datos públicos de tu comercio, visibles en tus servicios y en tu perfil.' | t }}</p>
        </div>
      </div>

      <form [formGroup]="infoForm" (ngSubmit)="continuar(guardarInfo())" class="config-form">
        <div class="rs-field">
          <label class="rs-lbl">{{ 'Nombre comercial *' | t }}</label>
          <input class="rs-inp" formControlName="nombreComercial" [placeholder]="'Ej: Residencia Canina Villa Perruna' | t"
                 [class.rs-inp--error]="infoForm.get('nombreComercial')?.invalid && infoForm.get('nombreComercial')?.touched" />
          @if (infoForm.get('nombreComercial')?.invalid && infoForm.get('nombreComercial')?.touched) {
            <span class="rs-field-error">{{ 'Campo requerido' | t }}</span>
          }
        </div>

        <!--
          Datos fiscales. Se piden aquí y no en el alta (perfilado progresivo),
          pero no había ningún sitio donde aportarlos: el paso "Datos fiscales
          (CIF/NIF)" del panel se quedaba pendiente para siempre.
        -->
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl" for="razonSocial">{{ 'Razón social' | t }}</label>
            <input id="razonSocial" class="rs-inp" formControlName="razonSocial"
                   [placeholder]="'Ej: Villa Perruna S.L.' | t" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl" for="vatNumber">{{ 'CIF / NIF' | t }}</label>
            <input id="vatNumber" class="rs-inp" formControlName="vatNumber"
                   [placeholder]="'Ej: B12345678' | t" />
            <span class="rs-field-hint">
              {{ 'Necesario antes de tu primera liquidación: es lo que va en las facturas.' | t }}
            </span>
          </div>
        </div>

        <div class="rs-field">
          <label class="rs-lbl">{{ 'Descripción del negocio' | t }}</label>
          <textarea class="rs-inp" formControlName="descripcion" rows="3"
                    [placeholder]="'Describe tu negocio, tu experiencia y lo que lo hace especial…' | t" style="resize:vertical"></textarea>
          <!-- Contador y guía de qué contar (TCK-8028) -->
          <span class="rs-field-hint contador" [class.contador--corta]="caracteresDescripcion() < 120">
            {{ caracteresDescripcion() }} / {{ MAX_DESCRIPCION }} caracteres.
            @if (caracteresDescripcion() < 120) {
              Cuenta qué te diferencia, con quién trabajas y qué incluye tu servicio: las fichas
              con más detalle reciben más reservas.
            }
          </span>
        </div>

        <div class="form-actions">
          <button type="button" class="rs-btn rs-btn--ghost" (click)="pasoAnterior()"
                  [disabled]="esPrimerPaso()">
            <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
            {{ 'Atrás' | t }}
          </button>
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoInfo()">
            @if (guardandoInfo()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              {{ esUltimoPaso() ? 'Guardar y finalizar' : 'Guardar y continuar' }}
            }
          </button>
        </div>
      </form>
    </section>
    }

    <!-- Ubicación -->
    <!-- Datos de contacto -->
@if (tab() === 'contacto') {
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(0,161,224,.12);color:var(--c-teal)">
          <rs-icon name="phone" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">{{ 'Datos de contacto' | t }}</h2>
          <p class="config-section__sub">{{ 'Información de contacto interna (no visible públicamente en tus servicios).' | t }}</p>
        </div>
      </div>

      <form [formGroup]="contactoForm" (ngSubmit)="continuar(guardarContacto())" class="config-form">
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">{{ 'Persona de contacto' | t }}</label>
            <input class="rs-inp" formControlName="nombreContacto" [placeholder]="'Nombre y apellidos' | t" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">{{ 'Correo electrónico *' | t }}</label>
            <input class="rs-inp" type="email" formControlName="email" placeholder="contacto@micomercio.com"
                   [class.rs-inp--error]="contactoForm.get('email')?.invalid && contactoForm.get('email')?.touched" inputmode="email" />
            @if (contactoForm.get('email')?.hasError('email') && contactoForm.get('email')?.touched) {
              <span class="rs-field-error">{{ 'Email no válido' | t }}</span>
            }
          </div>
        </div>
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">{{ 'Teléfono' | t }}</label>
            <rs-phone-input formControlName="telefono" [etiqueta]="'Teléfono del comercio' | t" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">WhatsApp</label>
            <rs-phone-input formControlName="whatsapp" [etiqueta]="'WhatsApp del comercio' | t" />
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="rs-btn rs-btn--ghost" (click)="pasoAnterior()"
                  [disabled]="esPrimerPaso()">
            <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
            {{ 'Atrás' | t }}
          </button>
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoContacto()">
            @if (guardandoContacto()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              {{ esUltimoPaso() ? 'Guardar y finalizar' : 'Guardar y continuar' }}
            }
          </button>
        </div>
      </form>
    </section>
    }

    <!-- Horario de atención -->
    <!-- Políticas y datos bancarios -->
@if (tab() === 'datosBancarios') {
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(22,163,74,.12);color:#16A34A">
          <rs-icon name="euro" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">{{ 'Datos bancarios' | t }}</h2>
          <p class="config-section__sub">{{ 'La cuenta en la que recibirás tus liquidaciones.' | t }}</p>
        </div>
      </div>

      <form [formGroup]="datosBancariosForm" (ngSubmit)="continuar(guardarDatosBancarios())" class="config-form">
        <div class="rs-field">
          <label class="rs-lbl">{{ 'Titular de la cuenta' | t }}</label>
          <input class="rs-inp" formControlName="titular" [placeholder]="'Nombre del titular' | t" />
        </div>
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">IBAN</label>
            <input class="rs-inp" formControlName="iban" [placeholder]="'ES00 0000 0000 0000 0000 0000' | t" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">{{ 'Banco' | t }}</label>
            <input class="rs-inp" formControlName="banco" [placeholder]="'Nombre del banco' | t" />
          </div>
        </div>
        <div class="rs-field">
          <label class="rs-lbl">{{ 'SWIFT / BIC' | t }}</label>
          <input class="rs-inp" formControlName="swift" [placeholder]="'Opcional' | t" />
        </div>
        <p class="rs-field-hint">{{ 'Estos datos sólo se usan para tus liquidaciones y nunca se muestran públicamente.' | t }}</p>

        <div class="form-actions">
          <button type="button" class="rs-btn rs-btn--ghost" (click)="pasoAnterior()"
                  [disabled]="esPrimerPaso()">
            <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
            {{ 'Atrás' | t }}
          </button>
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoDatosBancarios()">
            @if (guardandoDatosBancarios()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              {{ esUltimoPaso() ? 'Guardar y finalizar' : 'Guardar y continuar' }}
            }
          </button>
        </div>
      </form>
    </section>
    }

    <!-- Notificaciones -->
@if (tab() === 'notificaciones') {
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(245,158,11,.12);color:var(--c-amber)">
          <rs-icon name="bell" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">{{ 'Notificaciones' | t }}</h2>
          <p class="config-section__sub">{{ 'Elige qué alertas quieres recibir por email.' | t }}</p>
        </div>
      </div>

      <div class="notif-list">
        @for (n of notifItems; track n.key) {
          <div class="notif-row">
            <div class="notif-row__text">
              <div class="notif-row__label">{{ n.label | t }}</div>
              <div class="notif-row__desc">{{ n.desc }}</div>
            </div>
            <button
              class="toggle-btn"
              [class.toggle-btn--on]="notifState()[n.key]"
              (click)="toggleNotif(n.key)"
              [attr.aria-label]="'Notificación: ' + n.label">
              <div class="toggle-btn__thumb"></div>
            </button>
          </div>
        }
      </div>
          <!-- Sin formulario propio: estas secciones informan o se guardan solas al
           tocarlas, pero el recorrido no puede terminar aquí sin salida. -->
      <div class="form-actions">
        <button type="button" class="rs-btn rs-btn--ghost" (click)="pasoAnterior()"
                [disabled]="esPrimerPaso()">
          <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
          {{ 'Atrás' | t }}
        </button>
        @if (esUltimoPaso()) {
          <!-- El recorrido tiene final: sin esto el último paso sólo dejaba
               retroceder y no se sabía que ya estaba todo. -->
          <button type="button" class="rs-btn rs-btn--primary" (click)="terminar()">
            <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
            {{ 'Finalizar' | t }}
          </button>
        } @else {
          <button type="button" class="rs-btn rs-btn--primary" (click)="saltarPaso()">
            {{ 'Continuar' | t }}
            <rs-icon name="arrow-right" [size]="15" [stroke]="2"></rs-icon>
          </button>
        }
      </div>
    </section>
    }

    <!-- Verticales activas -->
@if (tab() === 'verticales') {
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(22,104,227,.12);color:var(--c-accent)">
          <rs-icon name="tag" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">{{ 'Servicios que ofreces' | t }}</h2>
          <p class="config-section__sub">
            {{ 'Marca las categorías en las que trabaja tu negocio. Aparecen en tu ficha pública.' | t }}
          </p>
        </div>
      </div>

      <!--
        Antes esto era una lista de insignias y un "contacta al soporte": el
        campo no estaba declarado en el DTO de actualización, así que el panel
        no podía tocarlo. Un negocio que suma peluquería a su residencia ya
        puede reflejarlo él mismo.
      -->
      <div class="vert-grid" role="group" [attr.aria-label]="'Categorías de servicio' | t">
        @for (v of verticalesDisponibles; track v.clave) {
          <button type="button" class="vert-chip" [class.vert-chip--on]="tieneVertical(v.clave)"
                  [attr.aria-pressed]="tieneVertical(v.clave)" (click)="alternarVertical(v.clave)">
            <span class="vert-chip__ico"><rs-icon [name]="v.icono" [size]="18" [stroke]="1.75"></rs-icon></span>
            <span class="vert-chip__txt">{{ v.label | t }}</span>
            @if (tieneVertical(v.clave)) {
              <rs-icon name="check" [size]="14" [stroke]="3" class="vert-chip__ok"></rs-icon>
            }
          </button>
        }
      </div>

      @if (!verticalesSel().length) {
        <p class="rs-field-err">{{ 'Marca al menos una categoría: sin ninguna, tu ficha no dice a qué te dedicas.' | t }}</p>
      } @else {
        <p class="rs-field-hint">
          {{ verticalesSel().length }}
          {{ verticalesSel().length === 1 ? 'categoría marcada' : 'categorías marcadas' }}.
        </p>
      }

      <div class="form-actions">
        <button type="button" class="rs-btn rs-btn--ghost" (click)="pasoAnterior()"
                [disabled]="esPrimerPaso()">
          <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
          {{ 'Atrás' | t }}
        </button>
        <button type="button" class="rs-btn rs-btn--primary"
                [disabled]="guardandoVerticales() || !verticalesSel().length"
                (click)="continuar(guardarVerticales())">
          @if (guardandoVerticales()) { Guardando… } @else {
            <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
            {{ esUltimoPaso() ? 'Guardar y finalizar' : 'Guardar y continuar' }}
          }
        </button>
      </div>
    </section>
    }
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .aviso-cambios { display: flex; align-items: center; gap: var(--sp-2); }

    .contador { display: block; margin-top: var(--sp-1); }
    .contador--corta { color: #B45309; }

    /*
     * ══ RECORRIDO PASO A PASO ═══════════════════════════════════════
     * Móvil primero: una sola columna con el resumen de avance, el paso actual
     * plegable y el formulario. A partir de 900px el índice se convierte en un
     * raíl fijo a la izquierda y el formulario ocupa el resto.
     */
    .cfg { display: grid; gap: var(--sp-5); align-items: start; }

    @media (min-width: 900px) {
      .cfg { grid-template-columns: 264px minmax(0, 1fr); gap: var(--sp-8); }
      /* 64px = alto de la barra superior, que es sticky. */
      .cfg__indice { position: sticky; top: calc(64px + var(--sp-4)); }
    }

    .cfg__indice { display: flex; flex-direction: column; gap: var(--sp-3); min-width: 0; }

    /* Avance del perfil: el número que resume si la ficha vende o no. */
    .cfg__resumen {
      padding: var(--sp-4);
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl);
      display: flex; flex-direction: column; gap: var(--sp-3);
    }
    .cfg__resumen-head { display: flex; align-items: center; gap: var(--sp-3); }
    .cfg__resumen-pct {
      font-family: var(--font-accent); font-size: var(--f-xl); font-weight: var(--w-8);
      color: var(--c-accent); line-height: 1;
    }
    .cfg__resumen-titulo { font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); }
    .cfg__resumen-nota { font-size: var(--f-xs); color: var(--t-400); margin-top: 2px; }
    .cfg__resumen-sub { font-size: var(--f-xs); color: var(--t-400); }
    .cfg__barra { height: 6px; border-radius: var(--r-full); background: var(--c-raised); overflow: hidden; }
    .cfg__barra span { display: block; height: 100%; border-radius: var(--r-full); background: var(--g-accent); transition: width var(--d-3); }

    /*
     * El botón que despliega el índice sólo existe en móvil: en escritorio el
     * raíl está siempre a la vista y un acordeón sería un clic de más.
     */
    .cfg__abrir {
      display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3);
      width: 100%; padding: var(--sp-3) var(--sp-4);
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl);
      color: var(--t-200); text-align: left; cursor: pointer;
    }
    .cfg__abrir-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .cfg__abrir-txt strong { font-size: var(--f-xs); font-weight: var(--w-7); color: var(--c-accent); text-transform: uppercase; letter-spacing: .06em; }
    .cfg__abrir-paso { font-size: var(--f-base); font-weight: var(--w-6); color: var(--t-100); }
    .cfg__abrir-chevron { flex-shrink: 0; transition: transform var(--d-2); }
    .cfg__abrir-chevron--abierto { transform: rotate(180deg); }

    .cfg__lista {
      display: none;
      flex-direction: column; gap: var(--sp-4);
      padding: var(--sp-4);
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-xl);
    }
    .cfg__lista--abierta { display: flex; }

    @media (min-width: 900px) {
      .cfg__abrir { display: none; }
      .cfg__lista { display: flex; }
    }

    .cfg__fase { display: flex; flex-direction: column; gap: 2px; }
    .cfg__fase-titulo {
      display: flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100);
    }
    .cfg__fase-num {
      display: inline-flex; align-items: center; justify-content: center;
      width: 20px; height: 20px; border-radius: var(--r-full);
      background: var(--c-raised); color: var(--t-400);
      font-size: 11px; font-weight: var(--w-7); flex-shrink: 0;
    }
    .cfg__fase-num--ok { background: #16A34A; color: #fff; }
    .cfg__fase-sub { font-size: var(--f-xs); color: var(--t-400); margin-bottom: var(--sp-2); padding-left: calc(20px + var(--sp-2)); }

    /* Cada paso es un objetivo táctil de 44px: se pulsa con el pulgar. */
    .cfg__paso {
      display: flex; align-items: center; gap: var(--sp-3);
      width: 100%; min-height: 44px; padding: var(--sp-2) var(--sp-3);
      border: 1px solid transparent; border-radius: var(--r-lg);
      background: transparent; color: var(--t-300);
      font-size: var(--f-sm); text-align: left; cursor: pointer;
      transition: background var(--d-2), color var(--d-2), border-color var(--d-2);

      &:hover { background: var(--c-raised); color: var(--t-100); }
    }
    .cfg__paso--actual {
      background: var(--c-accent-lo); border-color: rgba(8,37,139,.22);
      color: var(--c-accent); font-weight: var(--w-6);
    }
    .cfg__paso-estado {
      display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; border-radius: var(--r-full); flex-shrink: 0;
      background: var(--c-raised); color: var(--t-400);
    }
    .cfg__paso-estado--ok { background: rgba(22,163,74,.14); color: #16A34A; }
    .cfg__paso-estado--falta { color: var(--c-amber); }

    .cfg__faltan {
      display: flex; flex-direction: column; gap: var(--sp-2);
      padding-top: var(--sp-4); border-top: 1px solid var(--b-1);
    }
    .cfg__faltan-titulo { font-size: var(--f-xs); font-weight: var(--w-7); color: var(--t-300); text-transform: uppercase; letter-spacing: .06em; }
    .cfg__faltan-chips { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .cfg__chip {
      display: inline-flex; align-items: center; gap: var(--sp-1);
      padding: var(--sp-1) var(--sp-3); border-radius: var(--r-full);
      border: 1px dashed var(--b-2); background: transparent;
      color: var(--t-300); font-size: var(--f-xs); cursor: pointer; transition: all var(--d-2);
      &:hover { border-color: var(--c-accent); color: var(--c-accent); border-style: solid; }
    }

    .cfg__panel { display: flex; flex-direction: column; gap: var(--sp-4); min-width: 0; }

    .cfg__situacion {
      display: none;
      font-size: var(--f-xs); font-weight: var(--w-6); color: var(--t-400);
      text-transform: uppercase; letter-spacing: .06em;
    }
    .cfg__situacion-sep { opacity: .5; }
    @media (min-width: 900px) { .cfg__situacion { display: block; } }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); max-width: 60ch; }

    .config-section { padding: var(--sp-6); }
    .config-section__header { display: flex; align-items: flex-start; gap: var(--sp-4); margin-bottom: var(--sp-6); padding-bottom: var(--sp-5); border-bottom: 1px solid var(--b-1); }
    .config-section__icon { width: 44px; height: 44px; border-radius: var(--r-lg); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .config-section__title { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-1); }
    .config-section__sub { font-size: var(--f-sm); color: var(--t-400); }

    .config-form { display: flex; flex-direction: column; gap: var(--sp-4); }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); @media (max-width: 640px) { grid-template-columns: 1fr; } }
    .form-row--3 { grid-template-columns: 1fr 1fr 1fr; @media (max-width: 640px) { grid-template-columns: 1fr; } }
    /* El "Atrás" a la izquierda y el avance a la derecha: el orden de lectura. */
    .form-actions {
      display: flex; justify-content: space-between; align-items: center;
      gap: var(--sp-3); padding-top: var(--sp-2);
    }

    /* El texto largo del botón no cabe en un móvil; se acorta sin perder sentido. */
    .solo-movil { display: none; }
    @media (max-width: 768px) {
      .solo-escritorio { display: none; }
      .solo-movil { display: inline; }
    }
    .form-actions__grupo { display: flex; gap: var(--sp-2); }

    /* Filas de acciones que no cierran el paso: no compiten con su pie. */
    .form-actions--suelta { justify-content: flex-start; }

    /*
     * Móvil: el pie del paso se queda pegado al fondo mientras se rellena el
     * formulario, como el pie del alta de anfitrión de Airbnb. Sin esto había
     * que recorrer toda la sección —los horarios son siete tarjetas— para
     * encontrar el botón de guardar.
     *
     * .rs-card recorta con overflow:hidden, y un ancestro que recorta anula el
     * sticky de sus descendientes: por eso la sección deja de recortar en este
     * tamaño. No tiene hijos que se salgan de sus esquinas.
     */
    @media (max-width: 899px) {
      .config-section { overflow: visible; }

      .form-actions:not(.form-actions--suelta) {
        position: sticky;
        bottom: 0;
        z-index: 2;
        gap: var(--sp-2);
        margin: var(--sp-2) calc(var(--sp-6) * -1) calc(var(--sp-6) * -1);
        padding: var(--sp-3) var(--sp-6) calc(var(--sp-3) + env(safe-area-inset-bottom, 0px));
        background: var(--c-card);
        border-top: 1px solid var(--b-1);
        border-radius: 0 0 var(--r-xl) var(--r-xl);
      }

      /* El avance manda: ocupa el ancho que sobra y "Atrás" se queda mínimo. */
      .form-actions > .rs-btn--primary,
      .form-actions__grupo { flex: 1; min-width: 0; }
      .form-actions__grupo > .rs-btn { flex: 1 1 0; min-width: 0; }

      /*
       * .rs-btn viene con white-space: nowrap. En el pie de horarios caben tres
       * botones ("Atrás", "Guardar días especiales" y "Guardar y continuar") y a
       * 390px el del medio necesitaba 122px en una caja de 114: el rótulo se
       * derramaba fuera de su caja y el botón siguiente, opaco, lo tapaba —
       * parecían superpuestos. Con min-width: 0 la caja encoge, así que el
       * rótulo tiene que poder partirse en vez de desbordar.
       */
      .form-actions .rs-btn {
        padding-inline: var(--sp-3);
        white-space: normal; text-align: center; line-height: 1.25;
      }
    }

    .rs-field { display: flex; flex-direction: column; gap: var(--sp-2); }
    .rs-lbl { font-size: var(--f-xs); font-weight: var(--w-6); color: var(--t-300); text-transform: uppercase; letter-spacing: .06em; }
    .rs-field-error { font-size: var(--f-xs); color: #B91C1C; }
    .rs-field-hint { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); }
    .rs-hr { border-top: 1px solid var(--b-1); margin: var(--sp-2) 0; }

    .rs-checkbox { display: inline-flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-200); cursor: pointer; white-space: nowrap; }
    .rs-checkbox input { accent-color: var(--c-accent); width: 18px; height: 18px; }

    .verticales-list { display: flex; flex-wrap: wrap; gap: var(--sp-2); }

    /* Rejilla de categorías: se toca con el dedo, no es una lista de insignias. */
    .vert-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: var(--sp-3); margin-bottom: var(--sp-4);
    }
    .vert-chip {
      display: flex; align-items: center; gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4); min-height: 56px; text-align: left;
      border: 1px solid var(--b-2); border-radius: var(--r-lg);
      background: var(--c-card); color: var(--t-200); cursor: pointer;
      font-size: var(--f-sm); font-weight: var(--w-6);
      transition: border-color var(--d-2), background var(--d-2), color var(--d-2);

      &:hover { border-color: var(--c-accent); }
    }
    .vert-chip__ico { display: flex; flex-shrink: 0; color: var(--t-400); }
    .vert-chip__txt { flex: 1; min-width: 0; }
    .vert-chip__ok { flex-shrink: 0; }
    .vert-chip--on {
      border-color: var(--c-accent); background: var(--c-accent-lo); color: var(--t-100);
    }
    .vert-chip--on .vert-chip__ico,
    .vert-chip--on .vert-chip__ok { color: var(--c-accent); }

    @media (max-width: 480px) {
      .vert-grid { grid-template-columns: 1fr; gap: var(--sp-2); }
    }

    .notif-list { display: flex; flex-direction: column; gap: 0; }
    .notif-row { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); padding: var(--sp-4) 0; border-bottom: 1px solid var(--b-1); &:last-child { border: none; } }
    .notif-row__label { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .notif-row__desc { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); }

    .toggle-btn {
      position: relative;
      width: 44px;
      height: 24px;
      background: var(--c-raised);
      border: 1px solid var(--b-2);
      border-radius: var(--r-full);
      cursor: pointer;
      transition: background var(--d-2), border-color var(--d-2);
      flex-shrink: 0;
    }
    .toggle-btn--on { background: var(--c-accent); border-color: var(--c-accent); }
    .toggle-btn__thumb {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 16px;
      height: 16px;
      background: var(--t-400);
      border-radius: var(--r-full);
      transition: transform var(--d-2), background var(--d-2);
    }
    .toggle-btn--on .toggle-btn__thumb { transform: translateX(20px); background: #fff; }

  `],
})
export class ComercioConfigComponent implements OnInit {
  private readonly comercioApi = inject(ComercioApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly comercio = signal<MiComercio | null>(null);
  readonly guardado = signal(false);
  readonly errorMsg = signal('');

  /** Paso visible; la configuración era una sola página kilométrica (TCK-8028). */
  readonly tabs = TABS;
  readonly fases = FASES;
  readonly tab = signal<TabConfig>('perfil');

  /**
   * Índice desplegado. En escritorio el raíl está siempre a la vista y esta
   * señal no pinta nada; en móvil arranca cerrado para que la primera pantalla
   * sea el formulario y no la lista de pasos.
   */
  readonly indiceAbierto = signal(false);

  /**
   * Qué falta por rellenar en la ficha. Cada carencia sabe a qué pestaña lleva,
   * para que el aviso sea accionable y no un simple porcentaje.
   *
   * **No condiciona la publicación.** Lo que hace falta para salir en el
   * buscador se pide en el alta guiada; esto son los datos que redondean la
   * ficha, y un comercio con servicios publicados puede quedarse aquí al 70%
   * sin que eso le quite nada de la web.
   */
  readonly camposPerfil = computed(() => {
    const c = this.comercio();
    return [
      { label: 'Descripción del negocio', tab: 'perfil' as TabConfig, ok: !!c?.descripcion?.trim() },
      // El panel daba el perfil por completo sin CIF mientras el escritorio lo
      // seguía pidiendo: los dos contaban cosas distintas del mismo comercio.
      { label: 'Datos fiscales (CIF/NIF)', tab: 'perfil' as TabConfig, ok: !!c?.vatNumber },
      { label: 'Email de contacto', tab: 'contacto' as TabConfig, ok: !!c?.contacto?.email },
      { label: 'Teléfono', tab: 'contacto' as TabConfig, ok: !!c?.contacto?.telefono },
      { label: 'Datos bancarios', tab: 'datosBancarios' as TabConfig, ok: !!c?.datosBancarios?.iban },
      // Ya es un paso accionable, así que cuenta como los demás: antes devolvía
      // `null` en `estadoSeccion` y el índice lo pintaba sin estado.
      { label: 'Servicios que ofreces', tab: 'verticales' as TabConfig, ok: (c?.verticales?.length ?? 0) > 0 },
    ];
  });

  readonly progresoPerfil = computed(() => {
    const campos = this.camposPerfil();
    return Math.round((campos.filter((c) => c.ok).length / campos.length) * 100);
  });

  readonly faltantes = computed(() => this.camposPerfil().filter((c) => !c.ok));

  readonly guardandoInfo = signal(false);
  readonly guardandoContacto = signal(false);
  readonly guardandoDatosBancarios = signal(false);
  readonly guardandoVerticales = signal(false);

  /** Categorías marcadas en el paso "Servicios que ofreces". */
  readonly verticalesSel = signal<VerticalKey[]>([]);

  readonly verticalesDisponibles = Object.values(VerticalKey).map((clave) => ({
    clave,
    label: VERTICAL_LABELS[clave],
    icono: iconoVertical(clave),
  }));

  /** Longitud de la descripción, para el contador (TCK-8028). */
  readonly MAX_DESCRIPCION = 600;

  /** Formulario que corresponde a cada pestaña, para avisar de lo no guardado. */
  private formularioDeTab(): AbstractControl | null {
    switch (this.tab()) {
      case 'perfil': return this.infoForm;
      case 'contacto': return this.contactoForm;
      case 'datosBancarios': return this.datosBancariosForm;
      default: return null;
    }
  }

  readonly hayCambiosSinGuardar = signal(false);

  /** Se recalcula al cambiar de pestaña y en cada tecleo del formulario activo. */
  private vigilarCambios(): void {
    this.hayCambiosSinGuardar.set(this.formularioDeTab()?.dirty ?? false);
  }

  cambiarTab(clave: TabConfig): void {
    this.tab.set(clave);
    this.indiceAbierto.set(false);
    this.vigilarCambios();
    // Cada sección es larga: sin esto se cambia de paso y la vista se queda a
    // mitad del anterior, con el formulario nuevo fuera de pantalla.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Posición del paso actual, para el "Paso N de M" de la cabecera. */
  readonly pasoActual = computed(() => TABS.findIndex((t) => t.clave === this.tab()) + 1);
  readonly totalPasos = TABS.length;

  /** Etiqueta e icono del paso visible, para la cabecera plegable de móvil. */
  readonly pasoUi = computed(() => TABS[this.pasoActual() - 1] ?? TABS[0]);

  /** Fase que contiene el paso visible; siempre hay una, TABS y FASES coinciden. */
  readonly faseActual = computed(
    () => FASES.find((f) => f.pasos.some((p) => p.clave === this.tab())) ?? FASES[0],
  );

  /**
   * Una fase está hecha cuando ninguno de sus pasos con campos obligatorios
   * está pendiente. Los pasos informativos, como los avisos, no la bloquean.
   */
  faseCompleta(fase: { pasos: ReadonlyArray<PasoConfig> }): boolean {
    return fase.pasos.every((p) => this.estadoSeccion(p.clave) !== false);
  }
  readonly esPrimerPaso = computed(() => this.pasoActual() <= 1);
  readonly esUltimoPaso = computed(() => this.pasoActual() >= this.totalPasos);

  pasoAnterior(): void {
    const anterior = TABS[this.pasoActual() - 2];
    if (anterior) this.cambiarTab(anterior.clave);
  }

  /**
   * Avanza al paso siguiente **sólo si el guardado funcionó**.
   *
   * Se le pasa la promesa del `guardar*` de la sección, así cada formulario
   * conserva su propia validación y su propio payload y aquí sólo se decide si
   * se pasa de pantalla.
   */
  /** Avanza sin guardar, para las secciones que no tienen nada que enviar. */
  saltarPaso(): Promise<void> {
    return this.continuar(Promise.resolve(true));
  }

  /** Cierra el recorrido y devuelve al panel: el último paso ya no es un callejón. */
  terminar(): void {
    void this.router.navigate(['/comercio']);
  }

  async continuar(guardado: Promise<boolean>): Promise<void> {
    if (!(await guardado)) return;
    if (this.esUltimoPaso()) return;

    const siguiente = TABS[this.pasoActual()];
    if (siguiente) this.cambiarTab(siguiente.clave);
  }

  /**
   * ¿Está completa esta sección? Se calcula con los mismos campos que el aviso
   * de perfil incompleto, para que la marca de la pestaña y el porcentaje de la
   * cabecera no puedan contradecirse.
   *
   * `null` en las secciones que no tienen campos obligatorios (notificaciones…):
   * no se marcan ni como hechas ni como pendientes.
   */
  estadoSeccion(clave: TabConfig): boolean | null {
    const campos = this.camposPerfil().filter((c) => c.tab === clave);
    return campos.length ? campos.every((c) => c.ok) : null;
  }

  readonly caracteresDescripcion = signal(0);


  readonly notifState = signal<Record<string, boolean>>({
    nuevaReserva: true,
    cancelacion: true,
    resena: false,
    pagos: true,
  });

  readonly notifItems = [
    { key: 'nuevaReserva', label: 'Nueva reserva',  desc: 'Recibe un email cada vez que alguien reserve uno de tus servicios.' },
    { key: 'cancelacion',  label: 'Cancelación',    desc: 'Alerta cuando un cliente cancela una reserva confirmada.' },
    { key: 'resena',       label: 'Nueva reseña',   desc: 'Notificación cuando un cliente deja una reseña sobre tu servicio.' },
    { key: 'pagos',        label: 'Liquidaciones',  desc: 'Informe cuando se realiza una liquidación en tu cuenta.' },
  ];

  readonly infoForm = this.fb.group({
    nombreComercial: ['', Validators.required],
    razonSocial: [''],
    vatNumber: [''],
    descripcion: [''],
  });

  readonly contactoForm = this.fb.group({
    nombreContacto: [''],
    email: ['', [Validators.required, Validators.email]],
    telefono: [''],
    whatsapp: [''],
  });

  readonly datosBancariosForm = this.fb.group({
    titular: [''], iban: [''], banco: [''], swift: [''],
  });

  async ngOnInit(): Promise<void> {
    // Cualquier tecleo puede dejar el formulario sucio: se revisa en cada uno.
    // Los grupos tienen tipos distintos, así que se recorren como FormGroup suelto.
    const formularios: AbstractControl[] = [
      this.infoForm, this.contactoForm, this.datosBancariosForm,
    ];
    for (const formulario of formularios) {
      formulario.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.vigilarCambios());
    }

    // El contador se mantiene al día mientras se escribe.
    this.infoForm.controls.descripcion.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((texto) => this.caracteresDescripcion.set(String(texto ?? '').length));

    try {
      const data = await firstValueFrom(this.comercioApi.getMiComercio());
      this.aplicarDatos(data);
    } catch { /* usa formularios vacíos */ }

  }

  private aplicarDatos(data: MiComercio): void {
    this.comercio.set(data);
    this.verticalesSel.set((data.verticales ?? []) as VerticalKey[]);
    this.caracteresDescripcion.set((data.descripcion ?? '').length);

    this.infoForm.patchValue({
      nombreComercial: data.nombreComercial,
      razonSocial: data.razonSocial ?? '',
      vatNumber: data.vatNumber ?? '',
      descripcion: data.descripcion ?? '',
    });

    this.contactoForm.patchValue({
      nombreContacto: data.contacto?.nombreContacto ?? '',
      email: data.contacto?.email ?? '',
      telefono: data.contacto?.telefono ?? '',
      whatsapp: data.contacto?.whatsapp ?? '',
    });

    this.datosBancariosForm.patchValue({
      titular: data.datosBancarios?.titular ?? '',
      iban: data.datosBancarios?.iban ?? '',
      banco: data.datosBancarios?.banco ?? '',
      swift: data.datosBancarios?.swift ?? '',
    });

    if (data.preferenciasNotificacion) {
      this.notifState.set({ ...data.preferenciasNotificacion });
    }
  }

  labelVertical(v: string): string {
    return VERTICAL_LABELS[v as VerticalKey] ?? v;
  }

  toggleNotif(key: string): void {
    this.notifState.update(s => ({ ...s, [key]: !s[key] }));
    void this.guardarSeccion({ preferenciasNotificacion: this.notifState() as unknown as MiComercio['preferenciasNotificacion'] }, signal(false));
  }

  /**
   * @returns `true` si el guardado llegó al servidor. Lo necesita el paso a paso:
   * avanzar tras un error escondería el mensaje y el comercio creería que sus
   * datos están puestos cuando no lo están.
   */
  private async guardarSeccion(
    payload: ActualizarPerfilComercioPayload,
    guardando: WritableSignal<boolean>,
  ): Promise<boolean> {
    guardando.set(true);
    this.guardado.set(false);
    this.errorMsg.set('');
    try {
      const actualizado = await firstValueFrom(this.comercioApi.actualizarComercio(payload));
      this.comercio.set(actualizado);
      this.guardado.set(true);
      setTimeout(() => this.guardado.set(false), 3000);
      return true;
    } catch {
      this.errorMsg.set('Error al guardar los cambios. Intenta de nuevo.');
      setTimeout(() => this.errorMsg.set(''), 4000);
      return false;
    } finally {
      guardando.set(false);
    }
  }

  async guardarInfo(): Promise<boolean> {
    if (this.infoForm.invalid) { this.infoForm.markAllAsTouched(); return false; }
    const v = this.infoForm.getRawValue();
    return this.guardarSeccion({
      nombreComercial: v.nombreComercial,
      // Vacíos van como `undefined`: mandar '' borraría el CIF ya guardado y
      // además chocaría con el índice único de Mongo.
      razonSocial: v.razonSocial?.trim() || undefined,
      vatNumber: v.vatNumber?.trim().toUpperCase() || undefined,
      descripcion: v.descripcion,
    }, this.guardandoInfo);
  }

  async guardarContacto(): Promise<boolean> {
    if (this.contactoForm.invalid) { this.contactoForm.markAllAsTouched(); return false; }
    return this.guardarSeccion({ contacto: this.contactoForm.getRawValue() }, this.guardandoContacto);
  }

  tieneVertical(clave: VerticalKey): boolean {
    return this.verticalesSel().includes(clave);
  }

  alternarVertical(clave: VerticalKey): void {
    this.verticalesSel.update((sel) =>
      sel.includes(clave) ? sel.filter((v) => v !== clave) : [...sel, clave],
    );
    this.hayCambiosSinGuardar.set(true);
  }

  /**
   * El API exige al menos una categoría; el botón ya está deshabilitado sin
   * ninguna, pero la comprobación se repite aquí para no depender del estado
   * del botón si el método se llama desde otro sitio.
   */
  async guardarVerticales(): Promise<boolean> {
    const verticales = this.verticalesSel();
    if (!verticales.length) return false;
    const guardado = await this.guardarSeccion({ verticales }, this.guardandoVerticales);
    if (guardado) this.hayCambiosSinGuardar.set(false);
    return guardado;
  }

  async guardarDatosBancarios(): Promise<boolean> {
    const v = this.datosBancariosForm.getRawValue();
    return this.guardarSeccion({ datosBancarios: v }, this.guardandoDatosBancarios);
  }

}
