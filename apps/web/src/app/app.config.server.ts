import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

/**
 * Configuración del render de servidor: la del navegador más lo que sólo existe
 * en Node. No duplica nada de `appConfig`; lo extiende.
 */
const configServidor: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(serverRoutes))],
};

export const appConfigServidor = mergeApplicationConfig(appConfig, configServidor);
