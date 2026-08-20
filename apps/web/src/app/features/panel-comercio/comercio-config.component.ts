import { Component, signal, computed, inject, DestroyRef, OnInit, WritableSignal } from '@angular/core';
import { AbstractControl, ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsImageUploadComponent } from '../../shared/components/image-upload/rs-image-upload.component';
import { LugarElegido, RsPlaceAutocompleteComponent } from '../../shared/components/place-autocomplete/rs-place-autocomplete.component';
import { enlaceGoogleMaps } from '../../shared/mapas/google-maps';
import { RsPhoneInputComponent } from '../../shared/components/phone-input/rs-phone-input.component';
import { RsMapaComponent } from '../../shared/components/mapa/rs-mapa.component';
import { PROVINCIAS_ES } from '../../shared/catalogos/lugares.catalogo';
import { celdasDelMes, claveDia, desdeClaveDia, hoyLocal } from '../../shared/fechas';

/** Tope de `POST /upload/documento`. Debe seguir al del controlador del API. */
const MAX_DOCUMENTO_BYTES = 10 * 1024 * 1024;
import { environment } from '../../../environments/environment';
import { pareceImagen, prepararImagen, problemaDeSubida } from '../../shared/media/preparar-imagen';
import { DiagnosticoSubidaService } from '../../core/diagnostico/diagnostico-subida.service';
import { ComercioApiService, MiComercio, ActualizarPerfilComercioPayload, HorarioDia, ExcepcionHorario, DocumentoVerificacion } from './comercio-api.service';

type TabConfig =
  | 'perfil' | 'ubicacion' | 'contacto' | 'redes' | 'horarios' | 'politicas'
  | 'verificacion' | 'documentacion' | 'notificaciones' | 'verticales';

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
  { clave: 'ubicacion',      label: 'Ubicación',         icono: 'map-pin' },
  { clave: 'contacto',       label: 'Contacto',          icono: 'phone' },
  { clave: 'redes',          label: 'Redes',             icono: 'globe' },
  { clave: 'horarios',       label: 'Horarios',          icono: 'clock' },
  { clave: 'politicas',      label: 'Políticas y cobros', icono: 'euro' },
  { clave: 'verticales',     label: 'Servicios que ofreces', icono: 'tag' },
  { clave: 'verificacion',   label: 'Verificación',      icono: 'badge-check' },
  { clave: 'documentacion',  label: 'Documentación',     icono: 'file-text' },
  { clave: 'notificaciones', label: 'Notificaciones',    icono: 'bell' },
];

/**
 * Once pasos seguidos son una lista que nadie termina. Se agrupan en tres fases
 * con nombre —el patrón de alta de anfitrión de Airbnb y del extranet de
 * Booking—: el comercio ve tres bloques cortos, no once casillas.
 */
const FASES: ReadonlyArray<{
  readonly numero: number;
  readonly titulo: string;
  readonly resumen: string;
  readonly pasos: ReadonlyArray<PasoConfig>;
}> = [
  { numero: 1, titulo: 'Tu negocio',         resumen: 'Quién eres y dónde te encuentran',
    pasos: ['perfil', 'ubicacion', 'contacto', 'redes'] as TabConfig[] },
  { numero: 2, titulo: 'Cómo trabajas',      resumen: 'Horarios, condiciones y servicios',
    pasos: ['horarios', 'politicas', 'verticales'] as TabConfig[] },
  { numero: 3, titulo: 'Confianza y cuenta', resumen: 'Verificación y avisos',
    pasos: ['verificacion', 'documentacion', 'notificaciones'] as TabConfig[] },
].map((f) => ({
  ...f,
  pasos: f.pasos.map((clave) => TABS.find((t) => t.clave === clave) as PasoConfig),
}));

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

/**
 * `rs-image-upload` con `[multiple]="false"` emite **la URL suelta**, no un array
 * (ver `emitValue`). Los controles de imagen única guardan por tanto un `string`,
 * y `writeValue` ya acepta tanto la cadena como el array al cargar la ficha.
 *
 * Antes se declaraban como `string[]` y al guardar se hacía `arr[0]`: sobre la
 * cadena `"https://…"` eso devuelve `"h"`, que es lo que acabó escrito en la base
 * para el logo, la portada, el DNI y la licencia. La imagen salía rota al
 * recargar porque el `<img src="h">` no apunta a ninguna parte.
 */
type UrlImagen = string | null;

@Component({
  selector: 'app-comercio-config',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RsIconComponent, RsImageUploadComponent, RsPlaceAutocompleteComponent, RsPhoneInputComponent, RsMapaComponent,
  ],
  template: `
    <!-- Cabecera de la página -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Configura tu negocio</h1>
        <p class="page-sub">
          Tres bloques cortos. Puedes guardar y seguir, o entrar directamente al dato que quieras cambiar.
        </p>
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
              <p class="cfg__resumen-titulo">Perfil completado</p>
              <p class="cfg__resumen-sub">
                @if (faltantes().length === 1) {
                  Te falta 1 dato
                } @else if (faltantes().length) {
                  Te faltan {{ faltantes().length }} datos
                } @else {
                  Tu ficha está completa
                }
              </p>
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
            <span class="cfg__abrir-paso">{{ pasoUi().label }}</span>
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
                  {{ p.label }}
                </button>
              }
            </div>
          }

          <!-- Lo que falta, accionable: cada carencia lleva a su paso (TCK-8028).
               Va dentro del índice para que en móvil no se interponga entre el
               paso actual y su formulario. -->
          @if (faltantes().length) {
            <div class="cfg__faltan">
              <p class="cfg__faltan-titulo">Te falta por completar</p>
              <div class="cfg__faltan-chips">
                @for (f of faltantes(); track f.label) {
                  <button type="button" class="cfg__chip" (click)="cambiarTab(f.tab)">
                    <rs-icon name="plus" [size]="11" [stroke]="2.5"></rs-icon> {{ f.label }}
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
            Tienes cambios sin guardar en este paso. Pulsa el botón de guardar antes de salir.
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
          <p class="config-section__sub">Datos públicos de tu comercio, visibles en tus servicios y en tu perfil.</p>
        </div>
      </div>

      <form [formGroup]="infoForm" (ngSubmit)="continuar(guardarInfo())" class="config-form">
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
            <rs-image-upload origen="comercio/logo" [multiple]="false" [maxFiles]="1" formControlName="logoUrl"></rs-image-upload>
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Imagen de portada</label>
            <rs-image-upload origen="comercio/portada" [multiple]="false" [maxFiles]="1" formControlName="coverUrl"></rs-image-upload>
          </div>
        </div>

        <div class="rs-field">
          <label class="rs-lbl">Galería de fotos</label>
          <rs-image-upload origen="comercio/galeria" [multiple]="true" [maxFiles]="10" formControlName="galeria"></rs-image-upload>
          <span class="rs-field-hint">Muestra tus instalaciones, equipo y trabajo realizado.</span>
        </div>

        <div class="form-actions">
          <button type="button" class="rs-btn rs-btn--ghost" (click)="pasoAnterior()"
                  [disabled]="esPrimerPaso()">
            <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
            Atrás
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

      <form [formGroup]="direccionForm" (ngSubmit)="continuar(guardarDireccion())" class="config-form">
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
          <button type="button" class="rs-btn rs-btn--ghost" (click)="pasoAnterior()"
                  [disabled]="esPrimerPaso()">
            <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
            Atrás
          </button>
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoDireccion()">
            @if (guardandoDireccion()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              {{ esUltimoPaso() ? 'Guardar y finalizar' : 'Guardar y continuar' }}
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
          @if (enlaceGoogleMaps(); as url) {
            <a class="rs-btn rs-btn--outline rs-btn--sm" [href]="url" target="_blank" rel="noopener">
              <rs-icon name="map-pin" [size]="14" [stroke]="2"></rs-icon>
              Comprobar en Google Maps
            </a>
          }
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
          <p class="config-section__sub">Información de contacto interna (no visible públicamente en tus servicios).</p>
        </div>
      </div>

      <form [formGroup]="contactoForm" (ngSubmit)="continuar(guardarContacto())" class="config-form">
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
          <button type="button" class="rs-btn rs-btn--ghost" (click)="pasoAnterior()"
                  [disabled]="esPrimerPaso()">
            <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
            Atrás
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

      <form [formGroup]="redesForm" (ngSubmit)="continuar(guardarRedes())" class="config-form">
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
          <button type="button" class="rs-btn rs-btn--ghost" (click)="pasoAnterior()"
                  [disabled]="esPrimerPaso()">
            <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
            Atrás
          </button>
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoRedes()">
            @if (guardandoRedes()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              {{ esUltimoPaso() ? 'Guardar y finalizar' : 'Guardar y continuar' }}
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

      <form [formGroup]="horarioForm" (ngSubmit)="continuar(guardarHorario())" class="config-form">
        <div formArrayName="dias" class="horario-list">
          @for (dia of diasControls; track dia; let i = $index) {
            <div [formGroupName]="i" class="horario-row" [class.horario-row--cerrado]="dia.get('cerrado')?.value">
              <div class="horario-row__dia">
                <span class="horario-row__label">{{ dias[i].label }}</span>
                <label class="rs-checkbox">
                  <input type="checkbox" formControlName="cerrado" (change)="onCerradoChange(i)"> Cerrado
                </label>
              </div>

              <!--
                Las horas desaparecen al marcar "Cerrado": no significan nada ese
                día, y en el móvil son cuatro campos que estorban en una pantalla
                donde el espacio es lo que falta.
              -->
              @if (!dia.get('cerrado')?.value) {
                <div class="horario-row__tramos">
                  <div class="horario-tramo">
                    <span class="horario-tramo__et">Mañana</span>
                    <input class="rs-inp rs-inp--time" type="time" formControlName="abre"
                           aria-label="{{ dias[i].label }}: primer tramo, apertura">
                    <span class="horario-row__sep">—</span>
                    <input class="rs-inp rs-inp--time" type="time" formControlName="cierra"
                           aria-label="{{ dias[i].label }}: primer tramo, cierre">
                  </div>

                  <!-- Segundo tramo: muchos negocios cierran a mediodía (TCK-8028) -->
                  <div class="horario-tramo">
                    <span class="horario-tramo__et">Tarde</span>
                    <input class="rs-inp rs-inp--time" type="time" formControlName="abre2"
                           aria-label="{{ dias[i].label }}: segundo tramo, apertura">
                    <span class="horario-row__sep">—</span>
                    <input class="rs-inp rs-inp--time" type="time" formControlName="cierra2"
                           aria-label="{{ dias[i].label }}: segundo tramo, cierre">
                  </div>
                </div>
              } @else {
                <span class="horario-row__cerrado">Cerrado todo el día</span>
              }
            </div>
          }
        </div>

        <!-- Atajo del horario semanal. El guardado del paso está al final de la
             sección, después de los días especiales: si estuviera aquí, avanzar
             saltaría por encima de ellos. -->
        <div class="form-actions form-actions--suelta">
          <button type="button" class="rs-btn rs-btn--outline" (click)="copiarHorarioATodos()">
            <rs-icon name="copy" [size]="14" [stroke]="2"></rs-icon>
            <span class="solo-escritorio">Copiar el horario del lunes a todos los días</span>
            <span class="solo-movil">Copiar el lunes a todos</span>
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
                <span class="excepcion__fecha">{{ fechaLarga(e.fecha) }}</span>
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

        <!--
          Calendario con selección múltiple. Antes era un campo de fecha y un
          botón: un puente son cuatro días y agosto entero son treinta, y
          añadirlos de uno en uno —con su motivo cada vez— era la parte que
          nadie terminaba. Se marcan los que sean y se aplican de una vez.
        -->
        <div class="cal">
          <div class="cal__barra">
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                    (click)="cambiarMesExcepciones(-1)" aria-label="Mes anterior">
              <rs-icon name="chevron-left" [size]="16" [stroke]="2.5"></rs-icon>
            </button>
            <strong class="cal__mes">{{ nombreMes() }}</strong>
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                    (click)="cambiarMesExcepciones(1)" aria-label="Mes siguiente">
              <rs-icon name="chevron-right" [size]="16" [stroke]="2.5"></rs-icon>
            </button>
          </div>

          <div class="cal__semana" aria-hidden="true">
            @for (d of diasSemanaCorto; track $index) { <span>{{ d }}</span> }
          </div>

          <div class="cal__rejilla" role="group" aria-label="Elige los días especiales">
            @for (c of celdasExcepciones(); track c.clave) {
              <button type="button" class="cal__dia"
                      [class.cal__dia--fuera]="!c.delMes"
                      [class.cal__dia--sel]="c.seleccionado"
                      [class.cal__dia--puesto]="c.yaEsExcepcion"
                      [disabled]="c.pasado || c.yaEsExcepcion"
                      [attr.aria-pressed]="c.seleccionado"
                      [attr.title]="c.yaEsExcepcion ? 'Ya marcado como día especial' : null"
                      (click)="alternarDiaExcepcion(c)">
                {{ c.dia }}
              </button>
            }
          </div>

          <div class="cal__atajos">
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="seleccionarMesEntero()">
              Marcar el mes entero
            </button>
            @if (totalSeleccionados()) {
              <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="limpiarSeleccion()">
                Quitar la selección
              </button>
            }
          </div>
        </div>

        <!-- Lo que se aplica a TODOS los días marcados, para no repetirlo día a día. -->
        <div class="excepcion-form">
          <input class="rs-inp" type="text" [value]="nuevaExcepcionMotivo()"
                 (input)="nuevaExcepcionMotivo.set($any($event.target).value)"
                 placeholder="Motivo (ej. vacaciones de verano)" />
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
                  [disabled]="!totalSeleccionados()" (click)="anadirSeleccionados()">
            <rs-icon name="plus" [size]="14" [stroke]="2.5"></rs-icon>
            @if (totalSeleccionados()) {
              Añadir {{ totalSeleccionados() }} {{ totalSeleccionados() === 1 ? 'día' : 'días' }}
            } @else {
              Elige días en el calendario
            }
          </button>
        </div>

        <div class="form-actions">
          <button type="button" class="rs-btn rs-btn--ghost" (click)="pasoAnterior()"
                  [disabled]="esPrimerPaso()">
            <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
            Atrás
          </button>
          <div class="form-actions__grupo">
            <button type="button" class="rs-btn rs-btn--secondary" [disabled]="guardandoExcepciones()"
                    (click)="guardarExcepciones()">
              {{ guardandoExcepciones() ? 'Guardando…' : 'Guardar días especiales' }}
            </button>
            <button type="button" class="rs-btn rs-btn--primary" [disabled]="guardandoHorario()"
                    (click)="continuar(guardarHorario())">
              @if (guardandoHorario()) { Guardando… } @else {
                <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
                {{ esUltimoPaso() ? 'Guardar y finalizar' : 'Guardar y continuar' }}
              }
            </button>
          </div>
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

      <form [formGroup]="politicasForm" (ngSubmit)="continuar(guardarPoliticas())" class="config-form">
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
          <button type="button" class="rs-btn rs-btn--ghost" (click)="pasoAnterior()"
                  [disabled]="esPrimerPaso()">
            <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
            Atrás
          </button>
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoPoliticas()">
            @if (guardandoPoliticas()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              {{ esUltimoPaso() ? 'Guardar y finalizar' : 'Guardar y continuar' }}
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

      <form [formGroup]="verificacionForm" (ngSubmit)="continuar(guardarVerificacion())" class="config-form">
        <div class="form-row">
          <div class="rs-field">
            <label class="rs-lbl">Documento de identidad del titular</label>
            <rs-image-upload origen="comercio/dni" [multiple]="false" [maxFiles]="1" formControlName="documentoIdentidadUrl"></rs-image-upload>
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Licencia o registro del negocio</label>
            <rs-image-upload origen="comercio/licencia" [multiple]="false" [maxFiles]="1" formControlName="licenciaNegocioUrl"></rs-image-upload>
          </div>
        </div>
        <p class="rs-field-hint">Nuestro equipo revisará tus documentos en un plazo de 24–48 horas.</p>

        <div class="form-actions">
          <button type="button" class="rs-btn rs-btn--ghost" (click)="pasoAnterior()"
                  [disabled]="esPrimerPaso()">
            <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
            Atrás
          </button>
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardandoVerificacion()">
            @if (guardandoVerificacion()) { Guardando… } @else {
              <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
              {{ esUltimoPaso() ? 'Guardar y finalizar' : 'Guardar y continuar' }}
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
              <input type="file"
                     accept="application/pdf,image/*,.pdf"
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
        <div class="form-actions">
          <button type="button" class="rs-btn rs-btn--ghost" (click)="pasoAnterior()"
                  [disabled]="esPrimerPaso()">
            <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
            Atrás
          </button>
          <div class="form-actions__grupo">
            <!-- Añadir es lo que se repite; guardar y seguir cierra el paso. -->
            <button type="submit" class="rs-btn rs-btn--secondary" [disabled]="docForm.invalid">
              <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> Añadir documento
            </button>
            <button type="button" class="rs-btn rs-btn--primary" [disabled]="guardandoDocs()"
                    (click)="continuar(guardarDocumentacion())">
              @if (guardandoDocs()) { Guardando… } @else {
                <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
                {{ esUltimoPaso() ? 'Guardar y finalizar' : 'Guardar y continuar' }}
              }
            </button>
          </div>
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
          <!-- Sin formulario propio: estas secciones informan o se guardan solas al
           tocarlas, pero el recorrido no puede terminar aquí sin salida. -->
      <div class="form-actions">
        <button type="button" class="rs-btn rs-btn--ghost" (click)="pasoAnterior()"
                [disabled]="esPrimerPaso()">
          <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
          Atrás
        </button>
        @if (esUltimoPaso()) {
          <!-- El recorrido tiene final: sin esto el último paso sólo dejaba
               retroceder y no se sabía que ya estaba todo. -->
          <button type="button" class="rs-btn rs-btn--primary" (click)="terminar()">
            <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
            Finalizar
          </button>
        } @else {
          <button type="button" class="rs-btn rs-btn--primary" (click)="saltarPaso()">
            Continuar
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
          <h2 class="config-section__title">Verticales activas</h2>
          <p class="config-section__sub">Categorías de servicio en las que puedes publicar.</p>
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
          <!-- Sin formulario propio: estas secciones informan o se guardan solas al
           tocarlas, pero el recorrido no puede terminar aquí sin salida. -->
      <div class="form-actions">
        <button type="button" class="rs-btn rs-btn--ghost" (click)="pasoAnterior()"
                [disabled]="esPrimerPaso()">
          <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
          Atrás
        </button>
        @if (esUltimoPaso()) {
          <!-- El recorrido tiene final: sin esto el último paso sólo dejaba
               retroceder y no se sabía que ya estaba todo. -->
          <button type="button" class="rs-btn rs-btn--primary" (click)="terminar()">
            <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
            Finalizar
          </button>
        } @else {
          <button type="button" class="rs-btn rs-btn--primary" (click)="saltarPaso()">
            Continuar
            <rs-icon name="arrow-right" [size]="15" [stroke]="2"></rs-icon>
          </button>
        }
      </div>
    </section>
    }
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; }

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

    .cal { margin: var(--sp-4) 0; max-width: 380px; }
    .cal__barra { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-2); }
    .cal__mes { font-size: var(--f-sm); color: var(--t-100); text-transform: capitalize; }
    .cal__semana,
    .cal__rejilla { display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--sp-1); }
    .cal__semana span { text-align: center; font-size: var(--f-xs); color: var(--t-400); padding-bottom: var(--sp-1); }

    .cal__dia {
      /* 40px: el mínimo para acertar con el dedo sin apuntar. */
      aspect-ratio: 1; min-height: 40px;
      display: flex; align-items: center; justify-content: center;
      border: 1px solid transparent; border-radius: var(--r-md);
      background: transparent; cursor: pointer;
      font-size: var(--f-sm); color: var(--t-200);
      transition: background var(--d-1), color var(--d-1), border-color var(--d-1);

      &:hover:not(:disabled) { background: var(--c-raised); }
      &:disabled { cursor: default; opacity: .45; }
    }
    .cal__dia--fuera { color: var(--t-400); opacity: .5; }
    .cal__dia--sel {
      background: var(--c-accent); border-color: var(--c-accent);
      color: #fff; font-weight: var(--w-7);
    }
    /* Los ya guardados se distinguen de los que se están marcando ahora. */
    .cal__dia--puesto {
      border-color: var(--c-amber); color: var(--c-amber);
      font-weight: var(--w-6); opacity: 1;
    }
    .cal__atajos { display: flex; gap: var(--sp-2); margin-top: var(--sp-2); flex-wrap: wrap; }

    @media (max-width: 768px) {
      .cal { max-width: none; }
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
      .form-actions__grupo > .rs-btn { flex: 1; min-width: 0; }
      .form-actions .rs-btn { padding-inline: var(--sp-4); }
    }

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
    .horario-row {
      display: flex; align-items: center; gap: var(--sp-4);
      padding: var(--sp-2) 0; border-bottom: 1px solid var(--b-1);
      &:last-child { border: none; }
    }
    .horario-row__dia {
      display: flex; align-items: center; gap: var(--sp-3);
      width: 210px; flex-shrink: 0;
    }
    .horario-row__label { width: 90px; font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); flex-shrink: 0; }
    .horario-row__tramos { display: flex; align-items: center; gap: var(--sp-4); flex-wrap: wrap; }
    .horario-tramo { display: flex; align-items: center; gap: var(--sp-2); }
    .horario-tramo__et { font-size: var(--f-xs); color: var(--t-400); min-width: 48px; }
    .horario-row__sep { color: var(--t-400); }
    .horario-row__cerrado { font-size: var(--f-sm); color: var(--t-400); font-style: italic; }
    .rs-inp--time { width: 130px; padding: var(--sp-2) var(--sp-3); }

    /*
     * Móvil: en una fila caben la etiqueta del día y cuatro campos de hora de
     * 130px, o sea unos 700px. En 390 se salía de la pantalla y no había forma
     * de llegar a los campos de la derecha. Cada día pasa a ser una tarjeta con
     * sus tramos apilados y los campos a lo ancho.
     */
    @media (max-width: 768px) {
      .horario-list { gap: var(--sp-3); }

      .horario-row {
        flex-direction: column; align-items: stretch; gap: var(--sp-3);
        padding: var(--sp-4); border: 1px solid var(--b-1);
        border-radius: var(--r-lg); background: var(--c-raised);
      }
      .horario-row:last-child { border: 1px solid var(--b-1); }

      /* El día y su interruptor, en los extremos: se lee de un vistazo. */
      .horario-row__dia { width: auto; justify-content: space-between; }
      .horario-row__label { width: auto; font-size: var(--f-base); }

      .horario-row--cerrado { background: transparent; }

      .horario-row__tramos { flex-direction: column; align-items: stretch; gap: var(--sp-2); }
      .horario-tramo { gap: var(--sp-2); }
      .horario-tramo__et { min-width: 56px; }
      /* Los dos campos se reparten el ancho en vez de desbordar. */
      .rs-inp--time { width: auto; flex: 1; min-width: 0; }
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
  private readonly diagnostico = inject(DiagnosticoSubidaService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly http = inject(HttpClient);
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
   * sea el formulario y no la lista de once pasos.
   */
  readonly indiceAbierto = signal(false);

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
   * está pendiente. Los pasos informativos, como las redes, no la bloquean.
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
   * `null` en las secciones que no tienen campos obligatorios (redes…):
   * no se marcan ni como hechas ni como pendientes.
   */
  estadoSeccion(clave: TabConfig): boolean | null {
    const campos = this.camposPerfil().filter((c) => c.tab === clave);
    return campos.length ? campos.every((c) => c.ok) : null;
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

  /** Atajo para verificar el punto guardado en el mapa que usa todo el mundo. */
  readonly enlaceGoogleMaps = computed(() => {
    const punto = this.coordenadas();
    return punto ? enlaceGoogleMaps({ lat: punto.lat, lng: punto.lng, nombre: punto.titulo }) : null;
  });

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
    const elegido = input.files?.[0];
    if (!elegido) return;

    this.subiendoDoc.set(true);
    this.errorDoc.set('');
    try {
      /*
       * Una foto de iPhone llega en HEIC y sin reducir: en crudo sólo la pinta
       * Safari, y una del carrete de un modelo Pro se pasa de los 10 MB. Los PDF
       * pasan intactos: no son imágenes y no hay nada que convertir.
       */
      const esImagen = pareceImagen(elegido);
      const fichero = esImagen
        ? await prepararImagen(elegido, MAX_DOCUMENTO_BYTES)
        : elegido;

      // Un fichero vacío o un HEIC sin convertir sólo sirven para recibir un
      // 422 que el comercio lee como "formato no válido" (ver el mismo control
      // en `rs-image-upload`).
      const problema = esImagen ? problemaDeSubida(fichero, MAX_DOCUMENTO_BYTES) : null;
      if (problema) {
        this.diagnostico.registrar({
          paso: problema, destino: 'documento', origen: 'comercio/documentacion',
          fichero: elegido, resultado: fichero,
        });
        this.errorDoc.set(this.textoDelProblemaDoc(problema));
        return;
      }

      const datos = new FormData();
      datos.append('file', fichero);
      const { url } = await firstValueFrom(
        this.http.post<{ url: string }>(`${environment.apiUrl}/upload/documento`, datos),
      );
      this.docForm.patchValue({ url, nombre: this.docForm.value.nombre || elegido.name });
      this.diagnostico.registrar({
        paso: 'subida', destino: 'documento', origen: 'comercio/documentacion', fichero: elegido,
      });
    } catch (error) {
      this.diagnostico.registrarFalloHttp(
        { destino: 'documento', origen: 'comercio/documentacion', fichero: elegido }, error,
      );
      this.errorDoc.set('No se pudo subir el fichero. Debe ser PDF o imagen y pesar menos de 10 MB.');
    } finally {
      this.subiendoDoc.set(false);
      input.value = '';
    }
  }

  /** Por qué no se puede enviar la foto del documento, en cristiano. */
  private textoDelProblemaDoc(problema: 'vacio' | 'sin_convertir' | 'demasiado_grande'): string {
    if (problema === 'vacio') {
      return 'Ese archivo llegó vacío. Si la foto está en iCloud, ábrela primero en la app Fotos para que se descargue al móvil.';
    }
    if (problema === 'sin_convertir') {
      return 'No hemos podido convertir esa foto de iPhone (HEIC). Elígela desde la app Fotos, o cambia en Ajustes › Cámara › Formatos a «Más compatible».';
    }
    return 'El archivo pesa demasiado incluso después de reducirlo. Debe quedar por debajo de 10 MB.';
  }
  readonly caracteresDescripcion = signal(0);

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

  /** Mes visible del calendario de días especiales. */
  readonly mesExcepciones = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  /**
   * Días marcados en el calendario, sin guardar todavía.
   *
   * Se marcan varios y se aplican de una vez: un puente son cuatro días y las
   * vacaciones de agosto son treinta. Añadirlos de uno en uno, con su fecha y su
   * motivo cada vez, era la parte que nadie completaba.
   */
  readonly diasSeleccionados = signal<ReadonlySet<string>>(new Set());

  readonly nombreMes = computed(() =>
    this.mesExcepciones().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));

  /** Cabecera de la rejilla; la semana empieza en lunes. */
  readonly diasSemanaCorto = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  readonly celdasExcepciones = computed(() => {
    const mes = this.mesExcepciones();
    const seleccionados = this.diasSeleccionados();
    const yaPuestos = new Set(this.excepciones().map((e) => e.fecha));
    const hoy = hoyLocal().getTime();

    return celdasDelMes(mes).map((fecha) => {
      const clave = claveDia(fecha);
      return {
        clave,
        dia: fecha.getDate(),
        delMes: fecha.getMonth() === mes.getMonth(),
        // Marcar un festivo que ya pasó no cambia nada: se deja fuera para que
        // el calendario no invite a hacer algo sin efecto.
        pasado: fecha.getTime() < hoy,
        yaEsExcepcion: yaPuestos.has(clave),
        seleccionado: seleccionados.has(clave),
      };
    });
  });

  readonly totalSeleccionados = computed(() => this.diasSeleccionados().size);

  cambiarMesExcepciones(delta: number): void {
    const actual = this.mesExcepciones();
    this.mesExcepciones.set(new Date(actual.getFullYear(), actual.getMonth() + delta, 1));
  }

  /** Alterna un día de la selección. Los pasados y los ya puestos no se tocan. */
  alternarDiaExcepcion(celda: { clave: string; pasado: boolean; yaEsExcepcion: boolean }): void {
    if (celda.pasado || celda.yaEsExcepcion) return;

    this.diasSeleccionados.update((actuales) => {
      const nuevos = new Set(actuales);
      if (nuevos.has(celda.clave)) nuevos.delete(celda.clave);
      else nuevos.add(celda.clave);
      return nuevos;
    });
  }

  /** Marca de golpe el resto del mes visible: el caso de las vacaciones. */
  seleccionarMesEntero(): void {
    const disponibles = this.celdasExcepciones()
      .filter((c) => c.delMes && !c.pasado && !c.yaEsExcepcion)
      .map((c) => c.clave);

    this.diasSeleccionados.update((actuales) => new Set([...actuales, ...disponibles]));
  }

  limpiarSeleccion(): void {
    this.diasSeleccionados.set(new Set());
  }

  /**
   * Convierte la selección en días especiales, todos con el mismo motivo y el
   * mismo horario. Reemplaza los que ya existieran con esa fecha, igual que al
   * añadirlos de uno en uno.
   */
  anadirSeleccionados(): void {
    const seleccionados = [...this.diasSeleccionados()];
    if (!seleccionados.length) return;

    const cerrado = this.nuevaExcepcionCerrado();
    const motivo = this.nuevaExcepcionMotivo() || undefined;
    const abre = cerrado ? undefined : this.nuevaExcepcionAbre() || undefined;
    const cierra = cerrado ? undefined : this.nuevaExcepcionCierra() || undefined;

    this.excepciones.update((lista) => [
      ...lista.filter((e) => !seleccionados.includes(e.fecha)),
      ...seleccionados.map((fecha) => ({ fecha, motivo, cerrado, abre, cierra })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha)));

    this.limpiarSeleccion();
    this.nuevaExcepcionMotivo.set('');
    this.nuevaExcepcionAbre.set('');
    this.nuevaExcepcionCierra.set('');
  }

  /** Fecha larga y legible para la lista de días ya puestos. */
  fechaLarga(clave: string): string {
    return desdeClaveDia(clave).toLocaleDateString('es-ES', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
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

  async guardarExcepciones(): Promise<boolean> {
    return this.guardarSeccion({ excepcionesHorario: this.excepciones() }, this.guardandoExcepciones);
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
    logoUrl: [null as UrlImagen],
    coverUrl: [null as UrlImagen],
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
    documentoIdentidadUrl: [null as UrlImagen],
    licenciaNegocioUrl: [null as UrlImagen],
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
      logoUrl: data.logoUrl ?? null,
      coverUrl: data.coverUrl ?? null,
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
      documentoIdentidadUrl: data.verificacion?.documentoIdentidadUrl ?? null,
      licenciaNegocioUrl: data.verificacion?.licenciaNegocioUrl ?? null,
    });

    if (data.preferenciasNotificacion) {
      this.notifState.set({ ...data.preferenciasNotificacion });
    }
  }

  labelVertical(v: string): string {
    return VERTICAL_LABELS[v as VerticalKey] ?? v;
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
      descripcion: v.descripcion,
      logoUrl: v.logoUrl ?? undefined,
      coverUrl: v.coverUrl ?? undefined,
      galeria: v.galeria,
    }, this.guardandoInfo);
  }

  async guardarDireccion(): Promise<boolean> {
    const { lat, lng, ...campos } = this.direccionForm.getRawValue();
    // Un `lat: null` sobrescribiría con basura unas coordenadas ya guardadas;
    // si no hay punto, sencillamente no se envía el campo.
    const geo = lat != null && lng != null ? { lat, lng } : {};
    return this.guardarSeccion({ direccion: { ...campos, ...geo } }, this.guardandoDireccion);
  }

  async guardarContacto(): Promise<boolean> {
    if (this.contactoForm.invalid) { this.contactoForm.markAllAsTouched(); return false; }
    return this.guardarSeccion({ contacto: this.contactoForm.getRawValue() }, this.guardandoContacto);
  }

  async guardarRedes(): Promise<boolean> {
    const v = this.redesForm.getRawValue();
    return this.guardarSeccion({
      sitioWeb: v.sitioWeb,
      redesSociales: { instagram: v.instagram, facebook: v.facebook, tiktok: v.tiktok },
    }, this.guardandoRedes);
  }

  async guardarHorario(): Promise<boolean> {
    const horario: HorarioDia[] = this.diasControls.map(ctrl => ctrl.getRawValue());
    return this.guardarSeccion({ horario }, this.guardandoHorario);
  }

  async guardarPoliticas(): Promise<boolean> {
    const v = this.politicasForm.getRawValue();
    return this.guardarSeccion({
      politicaCancelacion: (v.politicaCancelacion || undefined) as MiComercio['politicaCancelacion'],
      datosBancarios: { titular: v.titular, iban: v.iban, banco: v.banco, swift: v.swift },
    }, this.guardandoPoliticas);
  }

  async guardarVerificacion(): Promise<boolean> {
    const v = this.verificacionForm.getRawValue();
    return this.guardarSeccion({
      documentoIdentidadUrl: v.documentoIdentidadUrl ?? undefined,
      licenciaNegocioUrl: v.licenciaNegocioUrl ?? undefined,
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

  async guardarDocumentacion(): Promise<boolean> {
    /*
     * Se envía sólo lo que el comercio aporta. `estado` y `subidoAt` los fija el
     * servidor —un comercio no puede marcar sus propios papeles como
     * verificados— y llegan de vuelta al leer la ficha; devolvérselos hace que
     * el API rechace la petición entera con 400.
     */
    const documentos = this.docsAdicionales().map((d) => ({
      tipo: d.tipo,
      nombre: d.nombre,
      url: d.url,
      fechaCaducidad: d.fechaCaducidad,
    }));

    return this.guardarSeccion({ documentos }, this.guardandoDocs);
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
