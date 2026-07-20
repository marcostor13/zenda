import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FavoritoResumenDto } from 'shared';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';

@Injectable({ providedIn: 'root' })
export class FavoritosService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = `${environment.apiUrl}/favoritos`;

  /** IDs de servicio favoritos del usuario, cacheados para pintar el estado del corazón. */
  private readonly _ids = signal<Set<string>>(new Set());
  readonly count = computed(() => this._ids().size);

  private cargado = false;

  /** Carga perezosa de los ids (una vez por sesión) para las tarjetas. */
  async cargarIds(): Promise<void> {
    if (this.cargado || !this.auth.estaAutenticado()) return;
    try {
      const ids = await firstValueFrom(this.http.get<string[]>(`${this.base}/ids`));
      this._ids.set(new Set(ids));
      this.cargado = true;
    } catch {
      // API no disponible — dejar el set vacío
    }
  }

  esFavorito(servicioId: string): boolean {
    return this._ids().has(servicioId);
  }

  listar(): Promise<FavoritoResumenDto[]> {
    return firstValueFrom(this.http.get<FavoritoResumenDto[]>(this.base));
  }

  /** Alterna el favorito y actualiza el cache local de forma optimista. */
  async toggle(servicioId: string): Promise<boolean> {
    const eraFavorito = this.esFavorito(servicioId);
    this.actualizarLocal(servicioId, !eraFavorito);
    try {
      if (eraFavorito) {
        await firstValueFrom(this.http.delete(`${this.base}/${servicioId}`));
      } else {
        await firstValueFrom(this.http.post(`${this.base}/${servicioId}`, {}));
      }
      return !eraFavorito;
    } catch {
      // Revertir si falla la llamada
      this.actualizarLocal(servicioId, eraFavorito);
      return eraFavorito;
    }
  }

  private actualizarLocal(servicioId: string, favorito: boolean): void {
    this._ids.update((set) => {
      const copia = new Set(set);
      if (favorito) copia.add(servicioId);
      else copia.delete(servicioId);
      return copia;
    });
  }
}
