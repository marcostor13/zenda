import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Rol } from 'shared';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../core/auth/guards/roles.guard';
import { PolizaDocument } from './poliza.schema';
import { PolizaRecomendada, SegurosService } from './seguros.service';

interface RequestConUsuario extends Request {
  user: { sub: string; comercioId?: string };
}

class ContratarPolizaDto {
  @IsString()
  servicioId!: string;

  @IsString()
  perroId!: string;

  @IsOptional()
  @IsString()
  reservaId?: string;

  @IsBoolean()
  declaracionVeracidadAceptada!: boolean;
}

class ValidarPolizaDto {
  @IsBoolean()
  aceptada!: boolean;

  @IsOptional()
  @IsString()
  motivoRechazo?: string;
}

@ApiTags('seguros')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('seguros')
export class SegurosController {
  constructor(private readonly segurosService: SegurosService) {}

  @Get('recomendaciones/:perroId')
  @ApiOperation({ summary: 'Seguros recomendados para una mascota, con el descuento de bienestar' })
  recomendaciones(
    @Param('perroId') perroId: string,
    @Req() req: RequestConUsuario,
  ): Promise<PolizaRecomendada[]> {
    return this.segurosService.recomendarPara(perroId, req.user.sub);
  }

  @Get('polizas/mis')
  @ApiOperation({ summary: 'Pólizas contratadas por el usuario' })
  misPolizas(@Req() req: RequestConUsuario): Promise<PolizaDocument[]> {
    return this.segurosService.listarDeUsuario(req.user.sub);
  }

  @Post('polizas')
  @ApiOperation({ summary: 'Contratar una póliza (queda pendiente de validación de la aseguradora)' })
  contratar(
    @Body() dto: ContratarPolizaDto,
    @Req() req: RequestConUsuario,
  ): Promise<PolizaDocument> {
    return this.segurosService.contratar({ ...dto, usuarioId: req.user.sub });
  }

  @Patch('polizas/:id/validar')
  @UseGuards(RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiOperation({ summary: 'La aseguradora confirma o rechaza la cobertura tras revisar los datos' })
  validar(
    @Param('id') id: string,
    @Body() dto: ValidarPolizaDto,
    @Req() req: RequestConUsuario,
  ): Promise<PolizaDocument> {
    return this.segurosService.validar(id, req.user.comercioId!, dto.aceptada, dto.motivoRechazo);
  }
}
