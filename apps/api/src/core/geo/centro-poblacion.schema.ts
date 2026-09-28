import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CentroPoblacionDocument = HydratedDocument<CentroPoblacion>;

/**
 * Centro de una población: el punto desde el que se mide «a 2,3 km del centro».
 *
 * Se geocodifica una vez por población y se guarda para siempre. El centro de
 * una ciudad no se mueve, y preguntarlo a Google en cada alta de servicio sería
 * pagar muchas veces por la misma respuesta. Tampoco se usa la media de los
 * servicios de la ciudad (`CatalogRepository.centroDePoblacion`): se desplaza
 * hacia donde hay comercios, y un polígono lleno de residencias caninas pasaría
 * a ser «el centro».
 */
@Schema({ collection: 'centros_poblacion', timestamps: true })
export class CentroPoblacion {
  /** `claveUbicacion` de la población: «Castellón de la Plana» → «castellondelaplana». */
  @Prop({ required: true, unique: true })
  clave!: string;

  @Prop({ required: true })
  ciudad!: string;

  @Prop({ required: true })
  lat!: number;

  @Prop({ required: true })
  lng!: number;
}

export const CentroPoblacionSchema = SchemaFactory.createForClass(CentroPoblacion);
