import {
  Controller,
  Post,
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
