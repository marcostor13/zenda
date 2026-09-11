/*
 * `reflect-metadata` va aquí y no sólo en los polyfills del navegador: los DTO
 * de `libs/shared` llevan decoradores de `class-validator`, y el bundle de
 * servidor los evalúa al extraer las rutas —antes de que Angular arranque—.
 * Sin esto el build falla con «Reflect.getMetadata is not a function».
 */
import 'reflect-metadata';

import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfigServidor } from './app/app.config.server';

/**
 * Punto de entrada del render de servidor.
 *
 * El `contexto` **no es opcional**: trae la plataforma que `@angular/ssr` ya ha
 * creado. Sin pasarlo, arrancar en servidor falla con NG0401 («No platform
 * exists!»), porque en modo servidor Angular no crea plataforma por su cuenta.
 */
export default (contexto: BootstrapContext) =>
  bootstrapApplication(AppComponent, appConfigServidor, contexto);
