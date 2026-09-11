import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SitemapService } from './sitemap.service';

/**
 * Endpoints que consume el servidor de la web para servir el sitemap bajo el
 * dominio público. No son API de producto: fuera de Swagger, que documenta lo
 * que usa el frontend y las integraciones.
 */
@ApiExcludeController()
@Controller('seo')
export class SeoController {
  constructor(private readonly sitemap: SitemapService) {}

  /**
   * `origen` lo manda el servidor de la web con el dominio con el que ha
   * llegado la visita. Si no llega, se usa el configurado: el sitemap tiene que
   * declarar URL absolutas y un sitemap con el dominio equivocado no sirve de
   * nada.
   */
  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  generar(@Query('origen') origen?: string): Promise<string> {
    return this.sitemap.xml(origen || process.env['WEB_PUBLIC_URL'] || 'https://doogking.com');
  }
}
