import {
  Controller,
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
  @ApiOperation({ summary: 'Webhook de Stripe (raw body requerido)' })
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    await this.paymentsService.procesarWebhook(req.rawBody!, signature);
    return { received: true };
  }
}
