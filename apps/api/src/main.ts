import * as dns from 'dns';
import * as dotenv from 'dotenv';
dotenv.config();

if (process.env.NODE_DNS_SERVERS) {
  dns.setServers(process.env.NODE_DNS_SERVERS.split(','));
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './shared/filters/domain-exception.filter';
import { origenesPermitidos } from './shared/cors-origenes';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const logger = new Logger('bootstrap');
  const enProduccion = process.env.NODE_ENV === 'production';

  /*
   * `contentSecurityPolicy` desactivada: el API solo devuelve JSON y ficheros
   * de `GET /upload/:id`, nunca HTML que ejecute scripts, y la CSP por defecto
   * de helmet rompería la UI de Swagger en desarrollo. El resto de cabeceras
   * (nosniff, frameguard, HSTS…) sí aplican.
   */
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  /*
   * Detrás del proxy de Coolify/nginx, `req.ip` es la IP del proxy y no la del
   * cliente: sin esto TODO el tráfico compartiría el mismo cubo del rate limit y
   * los usuarios legítimos se bloquearían entre ellos. Un solo salto de
   * confianza, el del proxy propio; más saltos permitirían falsear la IP con una
   * cabecera `X-Forwarded-For` inventada.
   */
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new DomainExceptionFilter());
  app.setGlobalPrefix('api/v1');

  // Los tokens viajan en la cabecera Authorization, no en cookies: sin
  // `credentials` no hace falta y así el navegador no manda cookies de terceros.
  const origenes = origenesPermitidos(
    process.env.CORS_ORIGINS,
    process.env.APP_URL,
    process.env.NODE_ENV,
  );
  app.enableCors({ origin: origenes, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'] });
  logger.log(`CORS permitido para: ${origenes.join(', ')}`);

  /*
   * Swagger publica el mapa completo de endpoints, DTOs y roles. Es la
   * herramienta de trabajo en desarrollo, pero en producción es un regalo para
   * quien busque por dónde entrar: se monta solo fuera de producción, salvo que
   * se pida explícitamente con SWAGGER_ENABLED=true.
   */
  if (!enProduccion || process.env.SWAGGER_ENABLED === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Doogking API')
      .setDescription('API del marketplace de servicios caninos — alojamiento, transporte, veterinaria, peluquería y adiestramiento')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
