import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Headers,
  RawBodyRequest,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CrearPaymentIntentDto, PaymentIntentResponseDto } from 'shared';

interface RequestConUsuario extends Request {
  user: { sub: string };
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear PaymentIntent de Stripe para una reserva' })
  crearIntent(
    @Body() dto: CrearPaymentIntentDto,
    @Req() req: RequestConUsuario,
  ): Promise<PaymentIntentResponseDto> {
    return this.paymentsService.crearIntent(dto.reservaId, req.user.sub);
  }

  /**
   * Qué permite el entorno. Lo pregunta el frontend en vez de deducirlo: si el
   * botón de omitir el pago se decidiera en el cliente, aparecería donde el
   * servidor no lo acepta y desaparecería donde sí.
   */
  @Get('configuracion')
  @ApiOperation({ summary: 'Capacidades de pago del entorno' })
  configuracion(): { bypassPagoHabilitado: boolean } {
    return { bypassPagoHabilitado: this.paymentsService.bypassHabilitado() };
  }

  /**
   * Da una reserva por pagada sin cobrar, para poder recorrer el flujo entero
   * en pruebas. Sólo funciona si el entorno lo permite (`PAGOS_BYPASS`); si no,
   * responde 403 aunque alguien llame al endpoint a mano.
   */
  @Post('reservas/:id/confirmar-sin-cobro')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirmar la reserva sin cobrar (sólo en entornos de prueba)' })
  confirmarSinCobro(
    @Param('id') id: string,
    @Req() req: RequestConUsuario,
  ): Promise<void> {
    return this.paymentsService.confirmarSinCobro(id, req.user.sub);
  }

  @Post('reservas/:id/ajuste/aceptar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Aceptar el ajuste de precio propuesto por el comercio (cobra la diferencia)' })
  aceptarAjuste(
    @Param('id') id: string,
    @Req() req: RequestConUsuario,
  ): Promise<PaymentIntentResponseDto> {
    return this.paymentsService.aceptarAjuste(id, req.user.sub);
  }

  @Post('reservas/:id/ajuste/rechazar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rechazar el ajuste: reembolsa el pago original y cancela la reserva' })
  async rechazarAjuste(
    @Param('id') id: string,
    @Req() req: RequestConUsuario,
  ): Promise<{ ok: boolean }> {
    await this.paymentsService.rechazarAjuste(id, req.user.sub);
    return { ok: true };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  /*
   * Sin límite a propósito: quien llama es Stripe desde un puñado de IPs y en
   * ráfagas (reintentos, backlog tras una caída). Bloquearle equivaldría a
   * perder confirmaciones de pago. La autenticidad la da la firma del webhook,
   * que se verifica en `procesarWebhook`, no el rate limit.
   */
  @SkipThrottle()
  @ApiOperation({ summary: 'Webhook de Stripe (raw body requerido)' })
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    await this.paymentsService.procesarWebhook(req.rawBody!, signature);
    return { received: true };
  }
}
