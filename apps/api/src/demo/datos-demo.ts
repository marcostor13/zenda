/**
 * Comercios y cuentas ficticios del entorno de desarrollo (dev.doogking.com).
 *
 * Los listados ya los siembran los seeders de cada vertical con un `comercioId`
 * fijo (`b0…01` a `b0…06`), pero nadie creaba esos comercios: en una base vacía
 * los servicios quedaban huérfanos, sin panel desde el que gestionarlos. Aquí se
 * declaran los dueños de esos ids, con una cuenta de acceso para cada uno.
 *
 * Todo es inventado: CIF con formato válido pero sin titular, correos en el
 * dominio reservado `.test`, IBAN de ejemplo. Nada de esto debe llegar a
 * producción, y el seeder se niega a escribirlo si la base ya tiene comercios
 * reales (ver `DatosDemoSeeder`).
 */
import { Rol, VerticalKey } from 'shared';

export const DOMINIO_CORREO_DEMO = 'doogking.test';

export interface ComercioDemo {
  readonly id: string;
  readonly nombreComercial: string;
  readonly razonSocial: string;
  readonly vatNumber: string;
  readonly verticales: readonly VerticalKey[];
  readonly plan: 'basico' | 'pro' | 'premium';
  readonly estado: 'activo' | 'pendiente';
  readonly calle: string;
  readonly codigoPostal: string;
  readonly responsable: string;
  readonly usuario: string;
}

export interface UsuarioDemo {
  readonly id: string;
  readonly nombre: string;
  readonly usuario: string;
  readonly rol: Rol;
  readonly comercioId?: string;
}

/** Los cinco primeros ids son los que usan los seeders de cada vertical. */
export const COMERCIOS_DEMO: readonly ComercioDemo[] = [
  {
    id: 'b00000000000000000000001', nombreComercial: 'Residencias Canis Madrid',
    razonSocial: 'Residencias Canis Madrid S.L. (ficticia)', vatNumber: 'B00000001',
    verticales: [VerticalKey.ALOJAMIENTO], plan: 'premium', estado: 'activo',
    calle: 'Calle de Alfonso XII 40', codigoPostal: '28014', responsable: 'Lucía Ferrer', usuario: 'alojamiento',
  },
  {
    id: 'b00000000000000000000002', nombreComercial: 'DogVan Traslados',
    razonSocial: 'DogVan Traslados S.L. (ficticia)', vatNumber: 'B00000002',
    verticales: [VerticalKey.TRANSPORTE], plan: 'pro', estado: 'activo',
    calle: 'Avenida de América 10', codigoPostal: '28028', responsable: 'Diego Ruiz', usuario: 'transporte',
  },
  {
    id: 'b00000000000000000000003', nombreComercial: 'Grupo Veterinario Royal Paws',
    razonSocial: 'Royal Paws Veterinaria S.L. (ficticia)', vatNumber: 'B00000003',
    verticales: [VerticalKey.VETERINARIA], plan: 'premium', estado: 'activo',
    calle: 'Calle de Santa Engracia 108', codigoPostal: '28003', responsable: 'Dra. Marta Gil', usuario: 'veterinaria',
  },
  {
    id: 'b00000000000000000000004', nombreComercial: 'Estilo Canino Peluquerías',
    razonSocial: 'Estilo Canino S.L. (ficticia)', vatNumber: 'B00000004',
    verticales: [VerticalKey.PELUQUERIA], plan: 'basico', estado: 'activo',
    calle: 'Calle del Espíritu Santo 12', codigoPostal: '28004', responsable: 'Elena Navarro', usuario: 'peluqueria',
  },
  {
    id: 'b00000000000000000000005', nombreComercial: 'Educadores Caninos K9',
    razonSocial: 'K9 Educación Canina S.L. (ficticia)', vatNumber: 'B00000005',
    verticales: [VerticalKey.ADIESTRAMIENTO], plan: 'pro', estado: 'activo',
    calle: 'Paseo del Embarcadero 12', codigoPostal: '28011', responsable: 'Carlos Ortega', usuario: 'adiestramiento',
  },
  {
    id: 'b00000000000000000000006', nombreComercial: 'Hoteles Pet Friendly Madrid',
    razonSocial: 'Pet Friendly Hoteles S.L. (ficticia)', vatNumber: 'B00000006',
    verticales: [VerticalKey.HOTELES], plan: 'pro', estado: 'activo',
    calle: 'Calle de Alcalá 176', codigoPostal: '28028', responsable: 'Sofía Prieto', usuario: 'hoteles',
  },
  // Sin listados y sin aprobar: para probar el alta y la aprobación desde el admin.
  {
    id: 'b00000000000000000000007', nombreComercial: 'Guardería Huellitas (pendiente)',
    razonSocial: 'Huellitas Guardería Canina S.L. (ficticia)', vatNumber: 'B00000007',
    verticales: [VerticalKey.ALOJAMIENTO], plan: 'basico', estado: 'pendiente',
    calle: 'Calle de Bravo Murillo 297', codigoPostal: '28020', responsable: 'Raúl Campos', usuario: 'pendiente',
  },
];

export const USUARIOS_DEMO: readonly UsuarioDemo[] = [
  { id: 'a00000000000000000000001', nombre: 'Admin Dev', usuario: 'admin', rol: Rol.ADMIN },
  { id: 'a00000000000000000000002', nombre: 'Ana Cliente', usuario: 'cliente', rol: Rol.CLIENTE },
  { id: 'a00000000000000000000003', nombre: 'Javier Cliente', usuario: 'cliente2', rol: Rol.CLIENTE },
  ...COMERCIOS_DEMO.map((comercio, indice) => ({
    id: `a000000000000000000000${String(indice + 10).padStart(2, '0')}`,
    nombre: comercio.responsable,
    usuario: comercio.usuario,
    rol: Rol.COMERCIO_ADMIN,
    comercioId: comercio.id,
  })),
];

export function correoDemo(usuario: string): string {
  return `${usuario}@${DOMINIO_CORREO_DEMO}`;
}
