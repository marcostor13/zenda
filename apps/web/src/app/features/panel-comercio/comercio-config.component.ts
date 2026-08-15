import { Component, signal, computed, inject, DestroyRef, OnInit, WritableSignal } from '@angular/core';
import { UpperCasePipe, TitleCasePipe } from '@angular/common';
import { AbstractControl, ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsImageUploadComponent } from '../../shared/components/image-upload/rs-image-upload.component';
import { LugarElegido, RsPlaceAutocompleteComponent } from '../../shared/components/place-autocomplete/rs-place-autocomplete.component';
import { RsPhoneInputComponent } from '../../shared/components/phone-input/rs-phone-input.component';
import { RsMapaComponent } from '../../shared/components/mapa/rs-mapa.component';
import { PROVINCIAS_ES } from '../../shared/catalogos/lugares.catalogo';
import { environment } from '../../../environments/environment';
import { ComercioApiService, MiComercio, ActualizarPerfilComercioPayload, HorarioDia, ExcepcionHorario, DocumentoVerificacion } from './comercio-api.service';

type TabConfig =
  | 'perfil' | 'ubicacion' | 'contacto' | 'redes' | 'horarios' | 'politicas'
  | 'verificacion' | 'documentacion' | 'notificaciones' | 'verticales' | 'plan';

const TABS: ReadonlyArray<{ clave: TabConfig; label: string; icono: string }> = [
  { clave: 'perfil',         label: 'Perfil',            icono: 'building' },
  { clave: 'ubicacion',      label: 'Ubicación',         icono: 'map-pin' },
  { clave: 'contacto',       label: 'Contacto',          icono: 'phone' },
  { clave: 'redes',          label: 'Redes',             icono: 'globe' },
  { clave: 'horarios',       label: 'Horarios',          icono: 'clock' },
  { clave: 'politicas',      label: 'Políticas y cobros', icono: 'euro' },
  { clave: 'verificacion',   label: 'Verificación',      icono: 'badge-check' },
  { clave: 'documentacion',  label: 'Documentación',     icono: 'file-text' },
  { clave: 'notificaciones', label: 'Notificaciones',    icono: 'bell' },
  { clave: 'verticales',     label: 'Verticales',        icono: 'tag' },
  { clave: 'plan',           label: 'Plan',              icono: 'sparkles' },
];

const DIAS: ReadonlyArray<{ clave: string; label: string }> = [
  { clave: 'lunes', label: 'Lunes' },
  { clave: 'martes', label: 'Martes' },
  { clave: 'miercoles', label: 'Miércoles' },
  { clave: 'jueves', label: 'Jueves' },
  { clave: 'viernes', label: 'Viernes' },
  { clave: 'sabado', label: 'Sábado' },
  { clave: 'domingo', label: 'Domingo' },
];

/** Con cuánta antelación se avisa de que un documento va a caducar. */
const DIAS_AVISO_CADUCIDAD = 30;

/** Lo que incluye cada plan; el precio se muestra tal cual, sin cálculos. */
const PLANES: Record<string, { precio: string; maxServicios: number | null; ventajas: string[] }> = {
  basico: {
    precio: 'Gratis',
    maxServicios: 3,
    ventajas: ['Hasta 3 servicios publicados', 'Reservas y pagos online', 'Perfil público en Doogking'],
  },
  pro: {
    precio: '29 € / mes',
    maxServicios: 15,
    ventajas: ['Hasta 15 servicios', 'Listados destacados en el buscador', 'Analítica de tu negocio'],
  },
  premium: {
    precio: '79 € / mes',
    maxServicios: null,
    ventajas: ['Servicios ilimitados', 'Máxima prioridad en el buscador', 'Soporte prioritario'],
  },
};

const VERIFICACION_BADGE: Record<string, string> = {
  sin_verificar: 'rs-badge--neutral',
  pendiente: 'rs-badge--warning',
  verificado: 'rs-badge--success',
  rechazado: 'rs-badge--error',
};

const VERIFICACION_LABEL: Record<string, string> = {
  sin_verificar: 'Sin verificar',
  pendiente: 'En revisión',
  verificado: 'Verificado',
  rechazado: 'Rechazado',
};

function primero(arr: string[]): string | undefined {
  return arr[0] || undefined;
}
function comoArray(v?: string): string[] {
  return v ? [v] : [];
}

@Component({
  selector: 'app-comercio-config',
  standalone: true,
  imports: [
    UpperCasePipe, TitleCasePipe, ReactiveFormsModule,
    RsIconComponent, RsImageUploadComponent, RsPlaceAutocompleteComponent, RsPhoneInputComponent, RsMapaComponent,
  ],
  template: `
    <!-- Page header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Perfil del comercio</h1>
        <p class="page-sub">Completa todos los datos de tu negocio: cuanta más información, más confianza generas ante los clientes.</p>
      </div>
    </div>

    @if (guardado()) {
      <div class="rs-alert rs-alert--success">
        <rs-icon name="check-circle" [size]="18" [stroke]="2"></rs-icon>
        Cambios guardados correctamente.
      </div>
    }
    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
    }

    <!-- Perfil completado: qué falta y dónde completarlo (TCK-8028) -->
    <div class="rs-card progreso-card">
      <div class="progreso-card__head">
        <strong class="progreso-card__titulo">Perfil completado</strong>
        <span class="progreso-card__pct">{{ progresoPerfil() }} %</span>
      </div>
      <div class="progreso-card__barra">
        <div class="progreso-card__fill" [style.width.%]="progresoPerfil()"></div>
      </div>
      @if (faltantes().length) {
        <p class="progreso-card__hint">Te falta por completar:</p>
        <div class="progreso-card__chips">
          @for (f of faltantes(); track f.label) {
            <button class="progreso-chip" (click)="cambiarTab(f.tab)">
              <rs-icon name="plus" [size]="12" [stroke]="2.5"></rs-icon> {{ f.label }}
            </button>
          }
        </div>
      } @else {
        <p class="progreso-card__hint">
          <rs-icon name="check-circle" [size]="14" [stroke]="2"></rs-icon>
          Tu ficha está completa. Así es como genera más confianza en los clientes.
        </p>
      }
    </div>

    <!-- Pestañas: la página era un scroll interminable (TCK-8028) -->
    <div class="config-tabs" role="tablist">
      @for (t of tabs; track t.clave) {
        <button class="config-tab" role="tab" [attr.aria-selected]="tab() === t.clave"
                [class.activa]="tab() === t.clave" (click)="cambiarTab(t.clave)">
          <rs-icon [name]="t.icono" [size]="14" [stroke]="2"></rs-icon> {{ t.label }}
        </button>
      }
    </div>

    <!-- Aviso de cambios sin guardar: guardar por sección es cómodo hasta que
         te vas de pestaña y pierdes lo escrito (TCK-8028) -->
    @if (hayCambiosSinGuardar()) {
      <div class="rs-alert rs-alert--warning aviso-cambios">
        <rs-icon name="alert-circle" [size]="16" [stroke]="2"></rs-icon>
        Tienes cambios sin guardar en esta pestaña. Pulsa el botón de guardar antes de salir.
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
          <h2 class="config-section__title">Información del negocio</h2>
          <p class="config-section__sub">Datos públicos de tu comercio, visibles en tus listados y en tu perfil.</p>
        </div>
      </div>

      <form [formGroup]="infoForm" (ngSubmit)="guardarInfo()" class="config-form">
        <div class="rs-field">
          <label class="rs-lbl">Nombre comercial *</label>
          <input class="rs-inp" formControlName="nombreComercial" placeholder="Ej: Residencia Canina Villa Perruna"
                 [class.rs-inp--error]="infoForm.get('nombreComercial')?.invalid && infoForm.get('nombreComercial')?.touched" />
          @if (infoForm.get('nombreComercial')?.invalid && infoForm.get('nombreComercial')?.touched) {
            <span class="rs-field-error">Campo requerido</span>
          }
        </div>

        <div class="rs-field">
          <label class="rs-lbl">Descripción del negocio</label>
          <textarea class="rs-inp" formControlName="descripcion" rows="3"
                    placeholder="Describe tu negocio, tu experiencia y lo que lo hace especial…" style="resize:vertical"></textarea>
          <!-- Contador y guía de qué contar (TCK-8028) -->
          <span class="rs-field-hint contador" [class.contador--corta]="caracteresDescripcion() < 120">
            {{ caracteresDescripcion() }} / {{ MAX_DESCRIPCION }} caracteres.
            @if (caracteresDescripcion() < 120) {
              Cuenta qué te diferencia, con quién trabajas y qué incluye tu servicio: las fichas
              con más detalle reciben más reservas.
            }
          </span>
        </div>

        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">Logo</label>
            <rs-image-upload [multiple]="false" [maxFiles]="1" formControlName="logoUrl"></rs-image-upload>
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Imagen de portada</label>
            <rs-image-upload [multiple]="false" [maxFiles]="1" formControlName="coverUrl"></rs-image-upload>
          </div>
        </div>

        <div class="rs-field">
          <label class="rs-lbl">Galería de fotos</label>
          <rs-image-upload [multiple]="true" [maxFiles]="10" formControlName="galeria"></rs-image-upload>
          <span class="rs-field-hint">Muestra tus instalaciones, equipo y trabajo realizado.</span>
        </div>

        <div class="form-actions">
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoInfo()">
            @if (guardandoInfo()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              Guardar información
            }
          </button>
        </div>
      </form>
    </section>
    }

    <!-- Ubicación -->
@if (tab() === 'ubicacion') {
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(16,185,129,.12);color:var(--c-success, #10B981)">
          <rs-icon name="map-pin" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Ubicación</h2>
          <p class="config-section__sub">Dirección desde la que operas o atiendes a tus clientes.</p>
        </div>
      </div>

      <form [formGroup]="direccionForm" (ngSubmit)="guardarDireccion()" class="config-form">
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">Calle</label>
            <rs-place-autocomplete formControlName="calle" inputId="cfg-calle" tipo="direccion"
                                   apariencia="campo" placeholder="Empieza a escribir tu dirección…"
                                   (lugarElegido)="usarDireccionSugerida($event)" />
            <span class="rs-field-hint">
              Elige tu dirección de la lista y rellenaremos el resto con la ubicación exacta.
            </span>
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Número</label>
            <input class="rs-inp" formControlName="numero" placeholder="Ej: 24, 2ºB" />
          </div>
        </div>
        <div class="form-row form-row--3">
          <div class="rs-field">
            <label class="rs-lbl">Ciudad</label>
            <rs-place-autocomplete formControlName="ciudad" inputId="cfg-ciudad"
                                   apariencia="campo" placeholder="Busca tu población…" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Provincia</label>
            <rs-place-autocomplete formControlName="provincia" inputId="cfg-provincia"
                                   apariencia="campo" placeholder="Elige provincia…"
                                   [catalogoLocal]="provincias" [usaPlaces]="false"
                                   [sugerenciasIniciales]="52" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Código postal</label>
            <input class="rs-inp" formControlName="codigoPostal" placeholder="Ej: 28013" />
          </div>
        </div>
        <div class="rs-field">
          <label class="rs-lbl">País</label>
          <input class="rs-inp" formControlName="pais" placeholder="España" />
        </div>

        <!-- Estado de las coordenadas: sin ellas el negocio no sale en el mapa
             del buscador, y eso el comercio tiene que saberlo antes de guardar. -->
        <div class="geo-estado" [class.geo-estado--ok]="coordenadas()">
          @if (coordenadas()) {
            <rs-icon name="check-circle" [size]="15" [stroke]="2"></rs-icon>
            <span>Ubicación exacta guardada: tu negocio se puede situar en el mapa.</span>
          } @else {
            <rs-icon name="alert-circle" [size]="15" [stroke]="2"></rs-icon>
            <span>
              Sin ubicación exacta. Elige tu dirección del desplegable para que aparezcas
              en el mapa del buscador.
            </span>
          }
        </div>

        <div class="form-actions">
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoDireccion()">
            @if (guardandoDireccion()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              Guardar ubicación
            }
          </button>
        </div>
      </form>

      <!-- Comprobar de un vistazo que la dirección cayó donde toca (TCK-8028) -->
      @if (coordenadas(); as punto) {
        <div class="mapa-ubicacion">
          <rs-mapa [puntos]="[punto]" [centro]="{ lat: punto.lat, lng: punto.lng, zoom: 16 }" />
          <p class="config-section__sub">
            Si el marcador no cae donde está tu negocio, corrige la dirección y vuelve a guardar.
          </p>
        </div>
      } @else {
        <p class="config-section__sub">
          Elige tu dirección del desplegable para ver el negocio situado en el mapa.
        </p>
      }
    </section>
    }

    <!-- Datos de contacto -->
@if (tab() === 'contacto') {
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(0,161,224,.12);color:var(--c-teal)">
          <rs-icon name="phone" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Datos de contacto</h2>
          <p class="config-section__sub">Información de contacto interna (no visible públicamente en los listados).</p>
        </div>
      </div>

      <form [formGroup]="contactoForm" (ngSubmit)="guardarContacto()" class="config-form">
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">Persona de contacto</label>
            <input class="rs-inp" formControlName="nombreContacto" placeholder="Nombre y apellidos" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Correo electrónico *</label>
            <input class="rs-inp" type="email" formControlName="email" placeholder="contacto@micomercio.com"
                   [class.rs-inp--error]="contactoForm.get('email')?.invalid && contactoForm.get('email')?.touched" />
            @if (contactoForm.get('email')?.hasError('email') && contactoForm.get('email')?.touched) {
              <span class="rs-field-error">Email no válido</span>
            }
          </div>
        </div>
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">Teléfono</label>
            <rs-phone-input formControlName="telefono" etiqueta="Teléfono del comercio" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">WhatsApp</label>
            <rs-phone-input formControlName="whatsapp" etiqueta="WhatsApp del comercio" />
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoContacto()">
            @if (guardandoContacto()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              Guardar contacto
            }
          </button>
        </div>
      </form>
    </section>
    }

    <!-- Redes y web -->
@if (tab() === 'redes') {
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(109,92,246,.12);color:var(--c-purple)">
          <rs-icon name="globe" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Redes sociales y web</h2>
          <p class="config-section__sub">Enlaces visibles en tu perfil público.</p>
        </div>
      </div>

      <form [formGroup]="redesForm" (ngSubmit)="guardarRedes()" class="config-form">
        <div class="rs-field">
          <label class="rs-lbl">Sitio web</label>
          <input class="rs-inp" formControlName="sitioWeb" placeholder="https://miweb.com" />
        </div>
        <div class="form-row form-row--3">
          <div class="rs-field">
            <label class="rs-lbl">Instagram</label>
            <input class="rs-inp" formControlName="instagram" placeholder="@usuario" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Facebook</label>
            <input class="rs-inp" formControlName="facebook" placeholder="facebook.com/miempresa" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">TikTok</label>
            <input class="rs-inp" formControlName="tiktok" placeholder="@usuario" />
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoRedes()">
            @if (guardandoRedes()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              Guardar enlaces
            }
          </button>
        </div>
      </form>
    </section>
    }

    <!-- Horario de atención -->
@if (tab() === 'horarios') {
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(245,158,11,.12);color:var(--c-amber)">
          <rs-icon name="calendar" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Horario de atención</h2>
          <p class="config-section__sub">Indica tus horas de apertura por día, incluida la jornada partida.</p>
        </div>
      </div>

      <form [formGroup]="horarioForm" (ngSubmit)="guardarHorario()" class="config-form">
        <div formArrayName="dias" class="horario-list">
          @for (dia of diasControls; track dia; let i = $index) {
            <div [formGroupName]="i" class="horario-row">
              <span class="horario-row__label">{{ dias[i].label }}</span>
              <label class="rs-checkbox">
                <input type="checkbox" formControlName="cerrado" (change)="onCerradoChange(i)"> Cerrado
              </label>
              <input class="rs-inp rs-inp--time" type="time" formControlName="abre">
              <span class="horario-row__sep">—</span>
              <input class="rs-inp rs-inp--time" type="time" formControlName="cierra">
              <!-- Segundo tramo: muchos negocios cierran a mediodía (TCK-8028) -->
              <input class="rs-inp rs-inp--time" type="time" formControlName="abre2" aria-label="Segundo tramo, apertura">
              <span class="horario-row__sep">—</span>
              <input class="rs-inp rs-inp--time" type="time" formControlName="cierra2" aria-label="Segundo tramo, cierre">
            </div>
          }
        </div>

        <div class="form-actions">
          <button type="button" class="rs-btn rs-btn--outline" (click)="copiarHorarioATodos()">
            Copiar el horario del lunes a todos los días
          </button>
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoHorario()">
            @if (guardandoHorario()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              Guardar horario
            }
          </button>
        </div>
      </form>

      <!-- Festivos, vacaciones y cierres puntuales (TCK-8028) -->
      <div class="excepciones">
        <h3 class="excepciones__titulo">Días especiales</h3>
        <p class="config-section__sub">
          Festivos, vacaciones o cierres puntuales. Mandan sobre el horario semanal.
        </p>

        @if (excepciones().length) {
          <div class="excepciones__lista">
            @for (e of excepciones(); track $index) {
              <div class="excepcion">
                <span class="excepcion__fecha">{{ e.fecha }}</span>
                <span class="excepcion__detalle">
                  {{ e.cerrado ? 'Cerrado' : (e.abre || '—') + ' — ' + (e.cierra || '—') }}
                  @if (e.motivo) { · {{ e.motivo }} }
                </span>
                <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                        (click)="quitarExcepcion($index)" aria-label="Quitar día especial">
                  <rs-icon name="x" [size]="13" [stroke]="2.5"></rs-icon>
                </button>
              </div>
            }
          </div>
        } @else {
          <p class="config-section__sub">Todavía no has marcado ningún día especial.</p>
        }

        <div class="excepcion-form">
          <input class="rs-inp" type="date" [value]="nuevaExcepcionFecha()"
                 (input)="nuevaExcepcionFecha.set($any($event.target).value)" aria-label="Fecha" />
          <input class="rs-inp" type="text" [value]="nuevaExcepcionMotivo()"
                 (input)="nuevaExcepcionMotivo.set($any($event.target).value)"
                 placeholder="Motivo (ej. vacaciones)" />
          <label class="rs-checkbox">
            <input type="checkbox" [checked]="nuevaExcepcionCerrado()"
                   (change)="nuevaExcepcionCerrado.set(!nuevaExcepcionCerrado())" /> Cerrado todo el día
          </label>
          @if (!nuevaExcepcionCerrado()) {
            <input class="rs-inp rs-inp--time" type="time" [value]="nuevaExcepcionAbre()"
                   (input)="nuevaExcepcionAbre.set($any($event.target).value)" aria-label="Abre" />
            <input class="rs-inp rs-inp--time" type="time" [value]="nuevaExcepcionCierra()"
                   (input)="nuevaExcepcionCierra.set($any($event.target).value)" aria-label="Cierra" />
          }
          <button type="button" class="rs-btn rs-btn--secondary rs-btn--sm"
                  [disabled]="!nuevaExcepcionFecha()" (click)="anadirExcepcion()">
            <rs-icon name="plus" [size]="14" [stroke]="2.5"></rs-icon> Añadir día
          </button>
        </div>

        <div class="form-actions">
          <button type="button" class="rs-btn rs-btn--primary" [disabled]="guardandoExcepciones()"
                  (click)="guardarExcepciones()">
            {{ guardandoExcepciones() ? 'Guardando…' : 'Guardar días especiales' }}
          </button>
        </div>
      </div>
    </section>
    }

    <!-- Políticas y datos bancarios -->
@if (tab() === 'politicas') {
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(239,68,68,.10);color:#B91C1C">
          <rs-icon name="shield-check" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Políticas y cobros</h2>
          <p class="config-section__sub">Política de cancelación y cuenta donde recibirás tus liquidaciones.</p>
        </div>
      </div>

      <form [formGroup]="politicasForm" (ngSubmit)="guardarPoliticas()" class="config-form">
        <div class="rs-field">
          <label class="rs-lbl">Política de cancelación por defecto</label>
          <select class="rs-inp" formControlName="politicaCancelacion">
            <option value="">— Sin especificar —</option>
            <option value="flexible">Flexible</option>
            <option value="moderada">Moderada</option>
            <option value="estricta">Estricta</option>
          </select>
        </div>

        <div class="rs-hr"></div>

        <div class="rs-field">
          <label class="rs-lbl">Titular de la cuenta</label>
          <input class="rs-inp" formControlName="titular" placeholder="Nombre del titular" />
        </div>
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">IBAN</label>
            <input class="rs-inp" formControlName="iban" placeholder="ES00 0000 0000 0000 0000 0000" />
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Banco</label>
            <input class="rs-inp" formControlName="banco" placeholder="Nombre del banco" />
          </div>
        </div>
        <div class="rs-field">
          <label class="rs-lbl">SWIFT / BIC</label>
          <input class="rs-inp" formControlName="swift" placeholder="Opcional" />
        </div>
        <p class="rs-field-hint">Estos datos sólo se usan para tus liquidaciones y nunca se muestran públicamente.</p>

        <div class="form-actions">
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoPoliticas()">
            @if (guardandoPoliticas()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              Guardar políticas y cobros
            }
          </button>
        </div>
      </form>
    </section>
    }

    <!-- Verificación de identidad -->
@if (tab() === 'verificacion') {
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(22,163,74,.12);color:#16A34A">
          <rs-icon name="badge-check" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Verificación de identidad</h2>
          <p class="config-section__sub">Sube tus documentos para obtener la insignia de comercio verificado.</p>
        </div>
        <span class="rs-badge {{ verificacionBadge() }}" style="margin-left:auto">{{ verificacionLabel() }}</span>
      </div>

      <form [formGroup]="verificacionForm" (ngSubmit)="guardarVerificacion()" class="config-form">
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">Documento de identidad del titular</label>
            <rs-image-upload [multiple]="false" [maxFiles]="1" formControlName="documentoIdentidadUrl"></rs-image-upload>
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Licencia o registro del negocio</label>
            <rs-image-upload [multiple]="false" [maxFiles]="1" formControlName="licenciaNegocioUrl"></rs-image-upload>
          </div>
        </div>
        <p class="rs-field-hint">Nuestro equipo revisará tus documentos en un plazo de 24–48 horas.</p>

        <div class="form-actions">
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoVerificacion()">
            @if (guardandoVerificacion()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              Enviar para verificación
            }
          </button>
        </div>
      </form>
    </section>
    }

    <!-- Documentación adicional (seguro RC, certificados…) -->
@if (tab() === 'documentacion') {
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(22,163,74,.12);color:#16A34A">
          <rs-icon name="shield-check" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Documentación adicional</h2>
          <p class="config-section__sub">Seguro de responsabilidad civil, certificados profesionales y sus caducidades.</p>
        </div>
      </div>

      @if (docsAdicionales().length) {
        <div class="docs-list">
          @for (d of docsAdicionales(); track $index) {
            <div class="doc-item">
              <span class="doc-item__tipo">{{ tipoDocLabel(d.tipo) }}</span>
              <span class="doc-item__nombre">{{ d.nombre || d.url }}</span>
              @if (d.fechaCaducidad) {
                <!-- Avisa antes de caducar, no el día que ya ha caducado (TCK-8028) -->
                <span class="doc-caduca"
                      [class.doc-caduca--pronto]="estadoCaducidad(d.fechaCaducidad) === 'pronto'"
                      [class.doc-caduca--caducado]="estadoCaducidad(d.fechaCaducidad) === 'caducado'">
                  @if (estadoCaducidad(d.fechaCaducidad) !== 'vigente') {
                    <rs-icon name="alert-circle" [size]="12" [stroke]="2"></rs-icon>
                  }
                  {{ textoCaducidad(d.fechaCaducidad) }}
                </span>
              }
              @if (d.estado) { <span class="rs-badge {{ docBadge(d.estado) }}">{{ d.estado }}</span> }
              <button type="button" class="rs-btn rs-btn--ghost rs-btn--xs" (click)="quitarDoc($index)" aria-label="Quitar documento">
                <rs-icon name="trash" [size]="13" [stroke]="2"></rs-icon>
              </button>
            </div>
          }
        </div>
      }

      <form [formGroup]="docForm" (ngSubmit)="agregarDoc()" class="config-form" style="margin-top:var(--sp-4)">
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">Tipo</label>
            <select formControlName="tipo" class="rs-inp">
              <option value="seguro_rc">Seguro responsabilidad civil</option>
              <option value="certificado">Certificado profesional</option>
              <option value="cif">CIF</option>
              <option value="licencia">Licencia</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Nombre / referencia</label>
            <input type="text" formControlName="nombre" class="rs-inp" placeholder="Ej. Póliza AXA 2026" />
          </div>
        </div>
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">URL del documento</label>
            <input type="text" formControlName="url" class="rs-inp" placeholder="https://…" />
            <!-- Subida real del fichero: pegar una URL a mano no lo hacía nadie (TCK-8028) -->
            <label class="subir-doc">
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp"
                     (change)="subirDocumento($event)" />
              <span class="rs-btn rs-btn--outline rs-btn--sm">
                <rs-icon name="download" [size]="13" [stroke]="2"></rs-icon>
                {{ subiendoDoc() ? 'Subiendo…' : 'Subir PDF o foto' }}
              </span>
            </label>
            @if (errorDoc()) { <span class="rs-field-error">{{ errorDoc() }}</span> }
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Fecha de caducidad</label>
            <input type="date" formControlName="fechaCaducidad" class="rs-inp" />
          </div>
        </div>
        <div class="form-actions" style="gap:var(--sp-2)">
          <button type="submit" class="rs-btn rs-btn--secondary" [disabled]="docForm.invalid">
              <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> Añadir documento
            </button>
          <button type="button" class="rs-btn rs-btn--primary" [disabled]="guardandoDocs()" (click)="guardarDocumentacion()">
            @if (guardandoDocs()) { Guardando… } @else { Guardar documentación }
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
          <h2 class="config-section__title">Notificaciones</h2>
          <p class="config-section__sub">Elige qué alertas quieres recibir por email.</p>
        </div>
      </div>

      <div class="notif-list">
        @for (n of notifItems; track n.key) {
          <div class="notif-row">
            <div class="notif-row__text">
              <div class="notif-row__label">{{ n.label }}</div>
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
          <h2 class="config-section__title">Verticales activas</h2>
          <p class="config-section__sub">Categorías de servicio en las que puedes publicar listados.</p>
        </div>
      </div>

      <div class="verticales-list">
        @for (v of comercio()?.verticales ?? []; track v) {
          <span class="rs-badge rs-badge--accent">{{ labelVertical(v) }}</span>
        }
        @if (!comercio()?.verticales?.length) {
          <span class="rs-badge rs-badge--neutral">Sin verticales configuradas</span>
        }
      </div>
      <p class="rs-field-hint">Para añadir o quitar verticales contacta al soporte.</p>
    </section>
    }

    <!-- Plan actual -->
@if (tab() === 'plan') {
    <section class="config-section rs-card">
      <div class="config-section__header">
        <div class="config-section__icon" style="background:rgba(109,92,246,.12);color:var(--c-purple)">
          <rs-icon name="sparkles" [size]="18" [stroke]="2"></rs-icon>
        </div>
        <div>
          <h2 class="config-section__title">Plan actual</h2>
          <p class="config-section__sub">Gestiona tu suscripción y beneficios.</p>
        </div>
      </div>

      <div class="plan-display">
        <div class="plan-badge-wrap">
          <span class="rs-badge {{ planBadgeClass() }} plan-badge">Plan {{ comercio()?.plan ?? 'básico' | uppercase }}</span>
          <span class="plan-precio">{{ planActual().precio }}</span>
        </div>

        <div class="plan-features">
          @for (f of planFeatures(); track f) {
            <div class="plan-feature">
              <rs-icon name="check-circle" [size]="15" [stroke]="2" style="color:var(--c-teal)"></rs-icon>
              <span>{{ f }}</span>
            </div>
          }
        </div>

        <!-- Límites de uso: sin esto el plan no dice nada útil (TCK-8028) -->
        <div class="plan-limites">
          <div class="plan-limite">
            <span class="plan-limite__texto">
              {{ serviciosPublicados() }} de
              {{ planActual().maxServicios === null ? 'ilimitados' : planActual().maxServicios }} servicios usados
            </span>
            @if (planActual().maxServicios !== null) {
              <div class="plan-barra">
                <div class="plan-barra__fill" [style.width.%]="pctServiciosUsados()"></div>
              </div>
            }
          </div>
        </div>

        @if (planSiguiente(); as siguiente) {
          <div class="plan-siguiente">
            <h3 class="plan-siguiente__titulo">Si pasas a Plan {{ siguiente.nombre | titlecase }}</h3>
            <p class="plan-siguiente__precio">{{ siguiente.precio }}</p>
            <ul class="plan-siguiente__lista">
              @for (v of siguiente.ventajas; track v) {
                <li><rs-icon name="check" [size]="13" [stroke]="2.5"></rs-icon> {{ v }}</li>
              }
            </ul>
          </div>
        }

        <a href="mailto:soporte@doogking.com?subject=Quiero%20mejorar%20mi%20plan%20Doogking"
           class="rs-btn rs-btn--primary" style="margin-top:var(--sp-4)">
          Ver planes y mejorar mi plan
        </a>
      </div>
    </section>
    }
  `,
  styles: [`
    :host { display: contents; }

    .plan-precio { font-size: var(--f-sm); color: var(--t-400); margin-left: var(--sp-3); }
    .plan-limites { margin-top: var(--sp-4); }
    .plan-limite__texto { font-size: var(--f-sm); color: var(--t-300); }
    .plan-barra { height: 8px; margin-top: var(--sp-2); border-radius: var(--r-full); background: var(--c-raised); overflow: hidden; max-width: 320px; }
    .plan-barra__fill { height: 100%; background: var(--g-accent); border-radius: var(--r-full); }
    .plan-siguiente { margin-top: var(--sp-5); padding: var(--sp-4); background: var(--c-raised); border-radius: var(--r-xl); }
    .plan-siguiente__titulo { font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); }
    .plan-siguiente__precio { font-family: var(--font-accent); font-size: var(--f-lg); color: var(--c-accent); margin-bottom: var(--sp-2); }
    .plan-siguiente__lista { display: flex; flex-direction: column; gap: var(--sp-1); list-style: none; font-size: var(--f-sm); color: var(--t-300); }
    .plan-siguiente__lista li { display: flex; align-items: center; gap: var(--sp-2); }

    .doc-caduca { display: inline-flex; align-items: center; gap: var(--sp-1); font-size: var(--f-xs); }
    .doc-caduca--pronto { color: #B45309; }
    .doc-caduca--caducado { color: var(--c-red, #B91C1C); font-weight: var(--w-6); }

    .subir-doc { display: inline-block; margin-top: var(--sp-2); cursor: pointer; }
    .subir-doc input[type="file"] { display: none; }
    .geo-estado {
      display: flex; align-items: flex-start; gap: var(--sp-2);
      padding: var(--sp-3) var(--sp-4);
      border-radius: var(--r-lg);
      background: var(--c-raised);
      font-size: var(--f-sm); color: var(--t-300);
    }
    .geo-estado rs-icon { flex-shrink: 0; color: var(--c-amber); }
    .geo-estado--ok rs-icon { color: var(--c-success, #10B981); }

    .mapa-ubicacion { margin-top: var(--sp-5); }
    .mapa-ubicacion rs-mapa { display: block; height: 260px; border-radius: var(--r-xl); overflow: hidden; }

    .aviso-cambios { display: flex; align-items: center; gap: var(--sp-2); }

    .contador { display: block; margin-top: var(--sp-1); }
    .contador--corta { color: #B45309; }

    .excepciones { margin-top: var(--sp-6); padding-top: var(--sp-5); border-top: 1px solid var(--b-1); }
    .excepciones__titulo { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-1); }
    .excepciones__lista { display: flex; flex-direction: column; gap: var(--sp-2); margin: var(--sp-3) 0; }
    .excepcion { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3); background: var(--c-raised); border-radius: var(--r-lg); flex-wrap: wrap; }
    .excepcion__fecha { font-family: var(--font-accent); font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); }
    .excepcion__detalle { flex: 1; font-size: var(--f-sm); color: var(--t-300); }
    .excepcion-form { display: flex; flex-wrap: wrap; gap: var(--sp-3); align-items: center; margin-top: var(--sp-3); }

    /* Perfil completado */
    .progreso-card { padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-3); }
    .progreso-card__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-4); }
    .progreso-card__titulo { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); }
    .progreso-card__pct { font-family: var(--font-accent); font-size: var(--f-xl); font-weight: var(--w-8); color: var(--c-accent); }
    .progreso-card__barra { height: 8px; border-radius: var(--r-full); background: var(--c-raised); overflow: hidden; }
    .progreso-card__fill { height: 100%; border-radius: var(--r-full); background: var(--g-accent); transition: width var(--d-3); }
    .progreso-card__hint { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-400); }
    .progreso-card__chips { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .progreso-chip {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-1) var(--sp-3); border-radius: var(--r-full);
      border: 1px dashed var(--b-2); background: transparent;
      color: var(--t-300); font-size: var(--f-xs); cursor: pointer; transition: all var(--d-2);
      &:hover { border-color: var(--c-accent); color: var(--c-accent); border-style: solid; }
    }

    /* Pestañas de configuración */
    .config-tabs {
      display: flex; gap: var(--sp-2); flex-wrap: wrap;
      padding-bottom: var(--sp-1);
    }
    .config-tab {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full);
      border: 1px solid var(--b-2); background: var(--c-raised);
      color: var(--t-300); font-size: var(--f-sm); cursor: pointer; transition: all var(--d-2);
      &:hover { border-color: var(--c-accent); color: var(--c-accent); }
      &.activa { background: var(--c-accent-lo); border-color: var(--c-accent); color: var(--c-accent); font-weight: var(--w-6); }
    }

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
    .form-actions { display: flex; justify-content: flex-end; padding-top: var(--sp-2); }

    .docs-list { display: flex; flex-direction: column; gap: var(--sp-2); }
    .doc-item { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; padding: var(--sp-3); background: var(--c-raised); border-radius: var(--r-lg); }
    .doc-item__tipo { font-size: var(--f-xs); font-weight: var(--w-7); color: var(--c-accent); }
    .doc-item__nombre { font-size: var(--f-sm); color: var(--t-100); flex: 1; min-width: 120px; }
    .doc-item__cad { font-size: var(--f-xs); color: var(--t-400); }

    .rs-field { display: flex; flex-direction: column; gap: var(--sp-2); }
    .rs-lbl { font-size: var(--f-xs); font-weight: var(--w-6); color: var(--t-300); text-transform: uppercase; letter-spacing: .06em; }
    .rs-field-error { font-size: var(--f-xs); color: #B91C1C; }
    .rs-field-hint { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); }
    .rs-hr { border-top: 1px solid var(--b-1); margin: var(--sp-2) 0; }

    .rs-checkbox { display: inline-flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-200); cursor: pointer; white-space: nowrap; }
    .rs-checkbox input { accent-color: var(--c-accent); width: 18px; height: 18px; }

    .verticales-list { display: flex; flex-wrap: wrap; gap: var(--sp-2); }

    .horario-list { display: flex; flex-direction: column; gap: var(--sp-2); }
    .horario-row { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) 0; border-bottom: 1px solid var(--b-1); &:last-child { border: none; } }
    .horario-row__label { width: 90px; font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); flex-shrink: 0; }
    .horario-row__sep { color: var(--t-400); }
    .rs-inp--time { width: 130px; padding: var(--sp-2) var(--sp-3); }

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

    .plan-display { display: flex; flex-direction: column; gap: var(--sp-4); }
    .plan-badge-wrap { display: flex; }
    .plan-badge { font-size: var(--f-sm); padding: var(--sp-2) var(--sp-5); }
    .plan-features { display: flex; flex-direction: column; gap: var(--sp-3); }
    .plan-feature { display: flex; align-items: center; gap: var(--sp-3); font-size: var(--f-sm); color: var(--t-200); }
  `],
})
export class ComercioConfigComponent implements OnInit {
  private readonly comercioApi = inject(ComercioApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly http = inject(HttpClient);

  readonly comercio = signal<MiComercio | null>(null);
  readonly guardado = signal(false);
  readonly errorMsg = signal('');

  /** Pestaña visible; la configuración era una sola página kilométrica (TCK-8028). */
  readonly tabs = TABS;
  readonly tab = signal<TabConfig>('perfil');

  /**
   * Qué falta por rellenar en la ficha. Cada carencia sabe a qué pestaña lleva,
   * para que el aviso sea accionable y no un simple porcentaje.
   */
  readonly camposPerfil = computed(() => {
    const c = this.comercio();
    const horarioPuesto = (c?.horario ?? []).some((d) => d.cerrado || (d.abre && d.cierra));
    return [
      { label: 'Descripción del negocio', tab: 'perfil' as TabConfig, ok: !!c?.descripcion?.trim() },
      { label: 'Logo', tab: 'perfil' as TabConfig, ok: !!c?.logoUrl },
      { label: 'Imagen de portada', tab: 'perfil' as TabConfig, ok: !!c?.coverUrl },
      { label: 'Galería de fotos', tab: 'perfil' as TabConfig, ok: (c?.galeria?.length ?? 0) > 0 },
      { label: 'Dirección', tab: 'ubicacion' as TabConfig, ok: !!c?.direccion?.calle && !!c?.direccion?.ciudad },
      { label: 'Email de contacto', tab: 'contacto' as TabConfig, ok: !!c?.contacto?.email },
      { label: 'Teléfono', tab: 'contacto' as TabConfig, ok: !!c?.contacto?.telefono },
      { label: 'Horario de atención', tab: 'horarios' as TabConfig, ok: horarioPuesto },
      { label: 'Política de cancelación', tab: 'politicas' as TabConfig, ok: !!c?.politicaCancelacion },
      { label: 'Datos bancarios', tab: 'politicas' as TabConfig, ok: !!c?.datosBancarios?.iban },
      { label: 'Verificación de identidad', tab: 'verificacion' as TabConfig, ok: c?.verificacion?.estado === 'verificado' },
    ];
  });

  readonly progresoPerfil = computed(() => {
    const campos = this.camposPerfil();
    return Math.round((campos.filter((c) => c.ok).length / campos.length) * 100);
  });

  readonly faltantes = computed(() => this.camposPerfil().filter((c) => !c.ok));

  readonly guardandoInfo = signal(false);
  readonly guardandoDireccion = signal(false);
  readonly guardandoContacto = signal(false);
  readonly guardandoRedes = signal(false);
  readonly guardandoHorario = signal(false);
  readonly guardandoPoliticas = signal(false);
  readonly guardandoVerificacion = signal(false);
  readonly guardandoExcepciones = signal(false);

  /** Longitud de la descripción, para el contador (TCK-8028). */
  readonly MAX_DESCRIPCION = 600;
  readonly subiendoDoc = signal(false);

  /** Formulario que corresponde a cada pestaña, para avisar de lo no guardado. */
  private formularioDeTab(): AbstractControl | null {
    switch (this.tab()) {
      case 'perfil': return this.infoForm;
      case 'ubicacion': return this.direccionForm;
      case 'contacto': return this.contactoForm;
      case 'redes': return this.redesForm;
      case 'horarios': return this.horarioForm;
      case 'politicas': return this.politicasForm;
      case 'verificacion': return this.verificacionForm;
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
    this.vigilarCambios();
  }
  readonly errorDoc = signal('');

  /**
   * Punto del mapa. Manda lo que hay en el formulario —así el marcador salta al
   * elegir la dirección, sin esperar a guardar— y si no, lo ya guardado.
   */
  readonly coordenadas = computed(() => {
    const enFormulario = this.geoFormulario();
    const guardada = this.comercio()?.direccion;
    const lat = enFormulario?.lat ?? guardada?.lat;
    const lng = enFormulario?.lng ?? guardada?.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      id: 'negocio',
      lat: lat as number,
      lng: lng as number,
      titulo: this.comercio()?.nombreComercial ?? 'Tu negocio',
    };
  });

  /** Coordenadas tecleadas en esta sesión; se refresca en cada cambio del formulario. */
  private readonly geoFormulario = signal<{ lat: number; lng: number } | null>(null);

  /**
   * Rellena la dirección con lo que devuelve Google y guarda el punto exacto.
   * Sin coordenadas el negocio no se puede situar en el mapa del buscador, así
   * que el desplegable es el camino recomendado, no un adorno.
   */
  usarDireccionSugerida(lugar: LugarElegido): void {
    const direccion = lugar.direccion;
    if (!direccion) return;

    this.direccionForm.patchValue({
      calle: direccion.calle || this.direccionForm.controls.calle.value,
      // El número llega aparte y sólo si el portal lo tiene; no se borra lo
      // que el comercio ya hubiera escrito (un "2ºB" que Google no conoce).
      numero: direccion.numero || this.direccionForm.controls.numero.value,
      codigoPostal: direccion.codigoPostal || this.direccionForm.controls.codigoPostal.value,
      ciudad: direccion.ciudad || this.direccionForm.controls.ciudad.value,
      provincia: direccion.provincia || this.direccionForm.controls.provincia.value,
      pais: direccion.pais || this.direccionForm.controls.pais.value,
      lat: direccion.lat,
      lng: direccion.lng,
    });
    this.direccionForm.markAsDirty();
    this.geoFormulario.set({ lat: direccion.lat, lng: direccion.lng });
  }

  /**
   * Sube el fichero y rellena la URL del documento. Se acepta PDF o foto: el
   * seguro llega en PDF y el certificado, casi siempre, en foto del móvil.
   */
  async subirDocumento(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const fichero = input.files?.[0];
    if (!fichero) return;

    this.subiendoDoc.set(true);
    this.errorDoc.set('');
    try {
      const datos = new FormData();
      datos.append('file', fichero);
      const { url } = await firstValueFrom(
        this.http.post<{ url: string }>(`${environment.apiUrl}/upload/documento`, datos),
      );
      this.docForm.patchValue({ url, nombre: this.docForm.value.nombre || fichero.name });
    } catch {
      this.errorDoc.set('No se pudo subir el fichero. Debe ser PDF o imagen y pesar menos de 10 MB.');
    } finally {
      this.subiendoDoc.set(false);
      input.value = '';
    }
  }
  readonly caracteresDescripcion = signal(0);

  /** Cuántos servicios tiene publicados, para el límite del plan (TCK-8028). */
  readonly serviciosPublicados = signal(0);

  readonly planActual = computed(() => PLANES[this.comercio()?.plan ?? 'basico'] ?? PLANES['basico']);

  readonly planSiguiente = computed(() => {
    const orden = ['basico', 'pro', 'premium'];
    const actual = this.comercio()?.plan ?? 'basico';
    const siguiente = orden[orden.indexOf(actual) + 1];
    return siguiente ? { nombre: siguiente, ...PLANES[siguiente] } : null;
  });

  readonly pctServiciosUsados = computed(() => {
    const maximo = this.planActual().maxServicios;
    if (maximo === null) return 0;
    return Math.min(100, Math.round((this.serviciosPublicados() / maximo) * 100));
  });

  /** Festivos, vacaciones y cierres puntuales (TCK-8028). */
  readonly excepciones = signal<ExcepcionHorario[]>([]);
  readonly nuevaExcepcionFecha = signal('');
  readonly nuevaExcepcionMotivo = signal('');
  readonly nuevaExcepcionCerrado = signal(true);
  readonly nuevaExcepcionAbre = signal('');
  readonly nuevaExcepcionCierra = signal('');

  /** Evita teclear siete veces el mismo horario (TCK-8028). */
  copiarHorarioATodos(): void {
    const lunes = this.diasControls[0].getRawValue();
    for (const control of this.diasControls.slice(1)) {
      control.patchValue({
        abre: lunes.abre, cierra: lunes.cierra,
        abre2: lunes.abre2, cierra2: lunes.cierra2,
        cerrado: lunes.cerrado,
      });
    }
  }

  anadirExcepcion(): void {
    const fecha = this.nuevaExcepcionFecha();
    if (!fecha) return;
    const cerrado = this.nuevaExcepcionCerrado();
    this.excepciones.update((lista) => [
      ...lista.filter((e) => e.fecha !== fecha),
      {
        fecha,
        motivo: this.nuevaExcepcionMotivo() || undefined,
        cerrado,
        abre: cerrado ? undefined : this.nuevaExcepcionAbre() || undefined,
        cierra: cerrado ? undefined : this.nuevaExcepcionCierra() || undefined,
      },
    ].sort((a, b) => a.fecha.localeCompare(b.fecha)));

    this.nuevaExcepcionFecha.set('');
    this.nuevaExcepcionMotivo.set('');
    this.nuevaExcepcionAbre.set('');
    this.nuevaExcepcionCierra.set('');
  }

  quitarExcepcion(indice: number): void {
    this.excepciones.update((lista) => lista.filter((_, i) => i !== indice));
  }

  async guardarExcepciones(): Promise<void> {
    await this.guardarSeccion({ excepcionesHorario: this.excepciones() }, this.guardandoExcepciones);
  }

  readonly dias = DIAS;
  readonly provincias = PROVINCIAS_ES;

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
    descripcion: [''],
    logoUrl: [[] as string[]],
    coverUrl: [[] as string[]],
    galeria: [[] as string[]],
  });

  readonly direccionForm = this.fb.group({
    calle: [''], numero: [''], ciudad: [''], provincia: [''], codigoPostal: [''], pais: ['España'],
    // No se editan a mano: los rellena el desplegable de direcciones. Viven en
    // el formulario para que el mapa reaccione antes de guardar.
    lat: [null as number | null], lng: [null as number | null],
  });

  readonly contactoForm = this.fb.group({
    nombreContacto: [''],
    email: ['', [Validators.required, Validators.email]],
    telefono: [''],
    whatsapp: [''],
  });

  readonly redesForm = this.fb.group({
    sitioWeb: [''], instagram: [''], facebook: [''], tiktok: [''],
  });

  readonly horarioForm = this.fb.group({
    dias: this.fb.array(DIAS.map(d => this.fb.group({
      dia: [d.clave],
      abre: ['09:00'],
      cierra: ['18:00'],
      abre2: [''],
      cierra2: [''],
      cerrado: [false],
    }))),
  });

  readonly politicasForm = this.fb.group({
    politicaCancelacion: [''],
    titular: [''], iban: [''], banco: [''], swift: [''],
  });

  readonly verificacionForm = this.fb.group({
    documentoIdentidadUrl: [[] as string[]],
    licenciaNegocioUrl: [[] as string[]],
  });

  readonly guardandoDocs = signal(false);
  readonly docsAdicionales = signal<DocumentoVerificacion[]>([]);
  readonly docForm = this.fb.group({
    tipo: ['seguro_rc', Validators.required],
    nombre: [''],
    url: ['', Validators.required],
    fechaCaducidad: [''],
  });

  get diasControls() {
    return this.horarioForm.controls.dias.controls;
  }

  async ngOnInit(): Promise<void> {
    // Cualquier tecleo puede dejar el formulario sucio: se revisa en cada uno.
    // Los grupos tienen tipos distintos, así que se recorren como FormGroup suelto.
    const formularios: AbstractControl[] = [
      this.infoForm, this.direccionForm, this.contactoForm, this.redesForm,
      this.horarioForm, this.politicasForm, this.verificacionForm,
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

    try {
      const servicios = await firstValueFrom(this.comercioApi.getMisServicios());
      this.serviciosPublicados.set(servicios.length);
    } catch {
      // Sin este dato el límite del plan no se pinta; el resto sigue igual.
    }
  }

  /**
   * Avisa antes de que caduque un seguro o certificado: enterarse el día que
   * expira ya es tarde (TCK-8028).
   */
  estadoCaducidad(fecha?: string): 'caducado' | 'pronto' | 'vigente' | null {
    if (!fecha) return null;
    const dias = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);
    if (dias < 0) return 'caducado';
    if (dias <= DIAS_AVISO_CADUCIDAD) return 'pronto';
    return 'vigente';
  }

  textoCaducidad(fecha?: string): string {
    const estado = this.estadoCaducidad(fecha);
    if (!estado || !fecha) return '';
    const dias = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);
    if (estado === 'caducado') return 'Caducado';
    if (estado === 'pronto') return `Caduca en ${dias} día${dias === 1 ? '' : 's'}`;
    return `Vigente hasta ${fecha}`;
  }

  private aplicarDatos(data: MiComercio): void {
    this.comercio.set(data);
    this.excepciones.set(data.excepcionesHorario ?? []);
    this.caracteresDescripcion.set((data.descripcion ?? '').length);

    this.infoForm.patchValue({
      nombreComercial: data.nombreComercial,
      descripcion: data.descripcion ?? '',
      logoUrl: comoArray(data.logoUrl),
      coverUrl: comoArray(data.coverUrl),
      galeria: data.galeria ?? [],
    });

    this.direccionForm.patchValue({
      calle: data.direccion?.calle ?? '',
      numero: data.direccion?.numero ?? '',
      ciudad: data.direccion?.ciudad ?? '',
      provincia: data.direccion?.provincia ?? '',
      codigoPostal: data.direccion?.codigoPostal ?? '',
      pais: data.direccion?.pais ?? 'España',
      // Se recargan para no perderlas al guardar un cambio de otro campo.
      lat: data.direccion?.lat ?? null,
      lng: data.direccion?.lng ?? null,
    });
    this.geoFormulario.set(null);

    this.contactoForm.patchValue({
      nombreContacto: data.contacto?.nombreContacto ?? '',
      email: data.contacto?.email ?? '',
      telefono: data.contacto?.telefono ?? '',
      whatsapp: data.contacto?.whatsapp ?? '',
    });

    this.redesForm.patchValue({
      sitioWeb: data.sitioWeb ?? '',
      instagram: data.redesSociales?.instagram ?? '',
      facebook: data.redesSociales?.facebook ?? '',
      tiktok: data.redesSociales?.tiktok ?? '',
    });

    if (data.horario?.length) {
      const porDia = new Map(data.horario.map(h => [h.dia, h]));
      this.diasControls.forEach((ctrl, i) => {
        const h = porDia.get(DIAS[i].clave);
        if (h) ctrl.patchValue({ abre: h.abre ?? '09:00', cierra: h.cierra ?? '18:00', cerrado: h.cerrado });
      });
    }

    this.politicasForm.patchValue({
      politicaCancelacion: data.politicaCancelacion ?? '',
      titular: data.datosBancarios?.titular ?? '',
      iban: data.datosBancarios?.iban ?? '',
      banco: data.datosBancarios?.banco ?? '',
      swift: data.datosBancarios?.swift ?? '',
    });

    this.docsAdicionales.set(data.verificacion?.documentos ?? []);
    this.verificacionForm.patchValue({
      documentoIdentidadUrl: comoArray(data.verificacion?.documentoIdentidadUrl),
      licenciaNegocioUrl: comoArray(data.verificacion?.licenciaNegocioUrl),
    });

    if (data.preferenciasNotificacion) {
      this.notifState.set({ ...data.preferenciasNotificacion });
    }
  }

  labelVertical(v: string): string {
    return VERTICAL_LABELS[v as VerticalKey] ?? v;
  }

  planBadgeClass(): string {
    const p = this.comercio()?.plan ?? 'basico';
    if (p === 'premium') return 'rs-badge--warning';
    if (p === 'pro') return 'rs-badge--accent';
    return 'rs-badge--neutral';
  }

  planFeatures(): string[] {
    const p = this.comercio()?.plan ?? 'basico';
    if (p === 'premium') return ['Listados ilimitados', 'Destacado en búsqueda', 'Analítica avanzada', 'Soporte prioritario 24/7', 'API de integración'];
    if (p === 'pro') return ['Hasta 20 listados', 'Destacado básico', 'Analítica estándar', 'Soporte por email'];
    return ['Hasta 3 listados', 'Sin destacados', 'Estadísticas básicas'];
  }

  verificacionBadge(): string {
    return VERIFICACION_BADGE[this.comercio()?.verificacion?.estado ?? 'sin_verificar'];
  }

  verificacionLabel(): string {
    return VERIFICACION_LABEL[this.comercio()?.verificacion?.estado ?? 'sin_verificar'];
  }

  onCerradoChange(i: number): void {
    const ctrl = this.diasControls[i];
    if (ctrl.get('cerrado')?.value) {
      ctrl.patchValue({ abre: '', cierra: '' });
    }
  }

  toggleNotif(key: string): void {
    this.notifState.update(s => ({ ...s, [key]: !s[key] }));
    void this.guardarSeccion({ preferenciasNotificacion: this.notifState() as unknown as MiComercio['preferenciasNotificacion'] }, signal(false));
  }

  private async guardarSeccion(
    payload: ActualizarPerfilComercioPayload,
    guardando: WritableSignal<boolean>,
  ): Promise<void> {
    guardando.set(true);
    this.guardado.set(false);
    this.errorMsg.set('');
    try {
      const actualizado = await firstValueFrom(this.comercioApi.actualizarComercio(payload));
      this.comercio.set(actualizado);
      this.guardado.set(true);
      setTimeout(() => this.guardado.set(false), 3000);
    } catch {
      this.errorMsg.set('Error al guardar los cambios. Intenta de nuevo.');
      setTimeout(() => this.errorMsg.set(''), 4000);
    } finally {
      guardando.set(false);
    }
  }

  async guardarInfo(): Promise<void> {
    if (this.infoForm.invalid) { this.infoForm.markAllAsTouched(); return; }
    const v = this.infoForm.getRawValue();
    await this.guardarSeccion({
      nombreComercial: v.nombreComercial,
      descripcion: v.descripcion,
      logoUrl: primero(v.logoUrl),
      coverUrl: primero(v.coverUrl),
      galeria: v.galeria,
    }, this.guardandoInfo);
  }

  async guardarDireccion(): Promise<void> {
    const { lat, lng, ...campos } = this.direccionForm.getRawValue();
    // Un `lat: null` sobrescribiría con basura unas coordenadas ya guardadas;
    // si no hay punto, sencillamente no se envía el campo.
    const geo = lat != null && lng != null ? { lat, lng } : {};
    await this.guardarSeccion({ direccion: { ...campos, ...geo } }, this.guardandoDireccion);
  }

  async guardarContacto(): Promise<void> {
    if (this.contactoForm.invalid) { this.contactoForm.markAllAsTouched(); return; }
    await this.guardarSeccion({ contacto: this.contactoForm.getRawValue() }, this.guardandoContacto);
  }

  async guardarRedes(): Promise<void> {
    const v = this.redesForm.getRawValue();
    await this.guardarSeccion({
      sitioWeb: v.sitioWeb,
      redesSociales: { instagram: v.instagram, facebook: v.facebook, tiktok: v.tiktok },
    }, this.guardandoRedes);
  }

  async guardarHorario(): Promise<void> {
    const horario: HorarioDia[] = this.diasControls.map(ctrl => ctrl.getRawValue());
    await this.guardarSeccion({ horario }, this.guardandoHorario);
  }

  async guardarPoliticas(): Promise<void> {
    const v = this.politicasForm.getRawValue();
    await this.guardarSeccion({
      politicaCancelacion: (v.politicaCancelacion || undefined) as MiComercio['politicaCancelacion'],
      datosBancarios: { titular: v.titular, iban: v.iban, banco: v.banco, swift: v.swift },
    }, this.guardandoPoliticas);
  }

  async guardarVerificacion(): Promise<void> {
    const v = this.verificacionForm.getRawValue();
    await this.guardarSeccion({
      documentoIdentidadUrl: primero(v.documentoIdentidadUrl),
      licenciaNegocioUrl: primero(v.licenciaNegocioUrl),
    }, this.guardandoVerificacion);
  }

  agregarDoc(): void {
    if (this.docForm.invalid) return;
    const v = this.docForm.getRawValue();
    this.docsAdicionales.update((list) => [...list, {
      tipo: v.tipo ?? 'otro',
      nombre: v.nombre || undefined,
      url: v.url ?? '',
      fechaCaducidad: v.fechaCaducidad || undefined,
      estado: 'pendiente',
    }]);
    this.docForm.reset({ tipo: 'seguro_rc', nombre: '', url: '', fechaCaducidad: '' });
  }

  quitarDoc(index: number): void {
    this.docsAdicionales.update((list) => list.filter((_, i) => i !== index));
  }

  async guardarDocumentacion(): Promise<void> {
    await this.guardarSeccion({ documentos: this.docsAdicionales() }, this.guardandoDocs);
  }

  tipoDocLabel(tipo: string): string {
    const map: Record<string, string> = {
      dni: 'DNI', cif: 'CIF', licencia: 'Licencia',
      seguro_rc: 'Seguro RC', certificado: 'Certificado', otro: 'Documento',
    };
    return map[tipo] ?? tipo;
  }

  docBadge(estado: string): string {
    const map: Record<string, string> = {
      verificado: 'rs-badge--success', pendiente: 'rs-badge--warning',
      rechazado: 'rs-badge--error', caducado: 'rs-badge--error',
    };
    return map[estado] ?? 'rs-badge--neutral';
  }
}
