import { Injectable } from '@nestjs/common';
import { ListaEsperaItemDto, SuscribirListaEsperaDto, SuscripcionListaEsperaDto } from 'shared';
import { ListaEsperaRepository } from './lista-espera.repository';

/** Origen por defecto: la pantalla de prelanzamiento. */
const ORIGEN_DEFAULT = 'proximamente';
/** Tope de filas devueltas al admin; evita traer la colección entera. */
const LIMITE_LISTADO = 500;

@Injectable()
export class ListaEsperaService {
  constructor(private readonly listaEsperaRepository: ListaEsperaRepository) {}

  async suscribir(dto: SuscribirListaEsperaDto): Promise<SuscripcionListaEsperaDto> {
    const email = dto.email.trim().toLowerCase();
    return this.listaEsperaRepository.suscribir(email, dto.origen?.trim() || ORIGEN_DEFAULT);
  }

  async listar(): Promise<{ total: number; items: ListaEsperaItemDto[] }> {
    const [documentos, total] = await Promise.all([
      this.listaEsperaRepository.listar(LIMITE_LISTADO),
      this.listaEsperaRepository.contar(),
    ]);

    return { total, items: documentos.map((documento) => this.aItemDto(documento)) };
  }

  private aItemDto(documento: {
    _id?: unknown;
    email: string;
    origen?: string;
    createdAt?: Date;
  }): ListaEsperaItemDto {
    return {
      id: String(documento._id ?? ''),
      email: documento.email,
      origen: documento.origen ?? ORIGEN_DEFAULT,
      createdAt: (documento.createdAt ?? new Date()).toISOString(),
    };
  }
}
