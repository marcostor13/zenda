import { Injectable, Logger } from '@nestjs/common';
import { PuntoGeo, claveUbicacion, distanciaKm, resolverMunicipio } from 'shared';
import { CentrosPoblacionRepository } from './centros-poblacion.repository';
import { GeoService } from './geo.service';

/**
 * Centro de cada población y distancia de un punto a él.
 *
 * Es lo que pone «a 2,3 km del centro» en las tarjetas del buscador, como hace
 * Booking. Se mide contra el centro de la población en la que el comercio dio
 * de alta el servicio.
 */
@Injectable()
export class CentrosPoblacionService {
  private readonly logger = new Logger(CentrosPoblacionService.name);

  constructor(
    private readonly repo: CentrosPoblacionRepository,
    private readonly geoService: GeoService,
  ) {}

  /**
   * Centro de la población; se geocodifica la primera vez y se guarda. `null`
   * si no se puede situar: la tarjeta sale sin distancia, que es mejor que
   * inventarse una.
   */
  async centroDe(ciudad: string, provincia?: string): Promise<PuntoGeo | null> {
    const nombre = resolverMunicipio(ciudad)?.municipio.nombre ?? ciudad.trim();
    const clave = claveUbicacion(nombre);
    if (!clave) return null;

    const guardado = await this.repo.buscar(clave);
    if (guardado) return guardado;

    const consulta = provincia && claveUbicacion(provincia) !== clave ? `${nombre}, ${provincia}` : nombre;
    const punto = await this.geoService.coordenadasDePoblacion(consulta);
    if (!punto) {
      this.logger.warn(`Sin centro para la población "${consulta}"`);
      return null;
    }
    await this.repo.guardar(clave, nombre, punto);
    return punto;
  }

  /** Km al centro de la población, redondeados a una décima; `null` si no hay centro. */
  async distanciaAlCentro(punto: PuntoGeo, ciudad: string, provincia?: string): Promise<number | null> {
    const centro = await this.centroDe(ciudad, provincia);
    if (!centro) return null;
    return Math.round(distanciaKm(punto, centro) * 10) / 10;
  }
}
