import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AnadirItemCarritoDto, PaymentIntentResponseDto, ValidacionCarritoDto } from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService } from '../payments/payments.service';
import { CarritoDocument } from './carrito.schema';
import { CarritoService } from './carrito.service';

interface RequestConUsuario extends Request {
  user: { sub: string };
}

@ApiTags('carrito')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('carrito')
export class CarritoController {
  constructor(
    private readonly carritoService: CarritoService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Viaje abierto del usuario (se crea vacío si no existe)' })
  obtener(@Req() req: RequestConUsuario): Promise<CarritoDocument> {
    return this.carritoService.obtenerAbierto(req.user.sub);
  }

  @Post('items')
  @ApiOperation({ summary: 'Añadir un servicio al viaje (no bloquea plaza todavía)' })
  anadir(
    @Body() dto: AnadirItemCarritoDto,
    @Req() req: RequestConUsuario,
  ): Promise<CarritoDocument> {
    return this.carritoService.anadirItem(req.user.sub, dto);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Quitar un servicio del viaje' })
  quitar(
    @Param('itemId') itemId: string,
    @Req() req: RequestConUsuario,
  ): Promise<CarritoDocument> {
    return this.carritoService.quitarItem(req.user.sub, itemId);
  }

  @Post('validar')
  @ApiOperation({ summary: 'Revalidar la disponibilidad de todo el viaje antes de pagar' })
  validar(@Req() req: RequestConUsuario): Promise<ValidacionCarritoDto> {
    return this.carritoService.validar(req.user.sub);
  }

  @Post('checkout')
  @ApiOperation({
    summary: 'Convierte el viaje en reservas independientes y prepara un único pago',
  })
  async checkout(@Req() req: RequestConUsuario): Promise<PaymentIntentResponseDto> {
    const resultado = await this.carritoService.checkout(req.user.sub);
    return this.paymentsService.crearIntentDeViaje(
      resultado.reservas.map((r) => r._id.toString()),
      req.user.sub,
    );
  }
}
