import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MovilService } from './core/movil/movil.service';
import { ConexionApiService } from './core/diagnostico/conexion-api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
@if (conexion.fallo()) {
  <!--
    Aviso de "el servidor no contesta". No es decorativo: sin él, un API
    inalcanzable deja la app en blanco y la única forma de saber a qué
    dirección estaba llamando es depurar el móvil por cable.
  -->
  <div class="sin-conexion" role="alert">
    <strong>No se puede conectar con el servidor.</strong>
    <span>Comprueba tu conexión. Si el problema sigue, avísanos.</span>
    <code>{{ conexion.apiUrl }}</code>
  </div>
}
<router-outlet />
  `,
  styles: [`
    .sin-conexion {
      position: fixed; inset: 0 0 auto 0; z-index: 9999;
      display: flex; flex-direction: column; gap: 2px;
      padding: calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px;
      background: #B91C1C; color: #fff;
      font-family: var(--font, system-ui, sans-serif); font-size: 13px; line-height: 1.4;
      box-shadow: 0 2px 12px rgba(0, 0, 0, .25);
    }
    /* La URL se enseña entera y partida: es el dato que identifica el fallo. */
    .sin-conexion code {
      font-size: 11px; opacity: .85; word-break: break-all;
    }
  `],
})
export class AppComponent implements OnInit {
  private readonly movil = inject(MovilService);
  protected readonly conexion = inject(ConexionApiService);

  ngOnInit(): void {
    // Arranque de la capa nativa (splash, barra de estado, botón atrás, push).
    // En el navegador no hace nada. `void` porque nada de la web debe esperar
    // a que termine: si algo nativo falla, la aplicación tiene que seguir.
    void this.movil.iniciar();
  }
}
