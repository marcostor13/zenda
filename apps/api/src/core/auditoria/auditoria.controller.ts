import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { EntidadAuditada, Rol } from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { AuditoriaService } from './auditoria.service';
import { RegistroAuditoriaDocument } from './auditoria.schema';

@ApiTags('auditoria')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN)
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @ApiOperation({ summary: 'Historial de acciones administrativas' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limite', required: false })
  @ApiQuery({ name: 'entidad', required: false, enum: EntidadAuditada })
  @ApiQuery({ name: 'entidadId', required: false })
  @ApiQuery({ name: 'buscar', required: false })
  listar(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limite', new DefaultValuePipe(30), ParseIntPipe) limite: number,
    @Query('entidad') entidad?: EntidadAuditada,
    @Query('entidadId') entidadId?: string,
    @Query('buscar') buscar?: string,
  ): Promise<{ items: RegistroAuditoriaDocument[]; total: number }> {
    return this.auditoriaService.listar({ entidad, entidadId, buscar }, page, limite);
  }
}
