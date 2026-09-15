import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdjuntosRegistroComponent } from './adjuntos-registro.component';
import { AdjuntoRegistroApi } from '../expediente.service';

describe('AdjuntosRegistroComponent', () => {
  let fixture: ComponentFixture<AdjuntosRegistroComponent>;

  const crear = (adjuntos: AdjuntoRegistroApi[], quitable = false) => {
    // Un test crea el componente dos veces, para comparar con y sin el aspa.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [AdjuntosRegistroComponent] });
    fixture = TestBed.createComponent(AdjuntosRegistroComponent);
    fixture.componentRef.setInput('adjuntos', adjuntos);
    fixture.componentRef.setInput('quitable', quitable);
    fixture.detectChanges();
  };

  const el = () => fixture.nativeElement as HTMLElement;
  const acciones = () =>
    Array.from(el().querySelectorAll<HTMLAnchorElement>('.adj__accion')).map((a) => a.textContent?.trim());

  const PDF: AdjuntoRegistroApi = {
    nombre: 'Analitica.pdf', url: 'https://cdn/a.pdf', tipo: 'application/pdf', tamano: 2048,
  };
  const WORD: AdjuntoRegistroApi = {
    nombre: 'Informe.docx', url: 'https://cdn/i.docx',
    tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  it('debería nombrar el documento con su peso', () => {
    crear([PDF]);

    expect(el().querySelector('.adj__nombre')?.textContent?.trim()).toBe('Analitica.pdf');
    expect(el().querySelector('.adj__peso')?.textContent?.trim()).toBe('2 KB');
  });

  /* Lo que pedía el encargo: verlo y descargarlo, que no son lo mismo. */
  it('debería ofrecer ver y descargar lo que el navegador sabe pintar', () => {
    crear([PDF]);

    expect(acciones()).toEqual(['Ver', 'Descargar']);
    const descarga = el().querySelectorAll<HTMLAnchorElement>('.adj__accion')[1];
    expect(descarga.getAttribute('href')).toBe('https://cdn/a.pdf');
    expect(descarga.getAttribute('download')).toBe('Analitica.pdf');
  });

  /*
   * Un Word no se abre en el navegador: ofrecer "Ver" sería un enlace que no
   * hace lo que dice, así que sólo se descarga.
   */
  it('no debería ofrecer ver un documento que el navegador no pinta', () => {
    crear([WORD]);

    expect(acciones()).toEqual(['Descargar']);
  });

  /* Los documentos de antes de que se guardara el tipo sólo tienen el nombre. */
  it('debería deducir el tipo por la extensión cuando no se guardó', () => {
    crear([{ nombre: 'radiografia.JPG', url: 'https://cdn/r.jpg' }]);

    expect(acciones()).toEqual(['Ver', 'Descargar']);
  });

  it('debería abrir siempre fuera de la ficha y sin exponer la página de origen', () => {
    crear([PDF]);

    for (const enlace of Array.from(el().querySelectorAll<HTMLAnchorElement>('.adj__accion'))) {
      expect(enlace.getAttribute('target')).toBe('_blank');
      expect(enlace.getAttribute('rel')).toContain('noopener');
    }
  });

  it('sólo debería dejar quitar documentos donde se pide', () => {
    crear([PDF]);
    expect(el().querySelector('.adj__quitar')).toBeNull();

    crear([PDF], true);
    const quitado: AdjuntoRegistroApi[] = [];
    fixture.componentInstance.quitar.subscribe((a) => quitado.push(a));

    el().querySelector<HTMLButtonElement>('.adj__quitar')!.click();

    expect(quitado).toEqual([PDF]);
  });

  it('debería redondear el peso a MB cuando el fichero es grande', () => {
    crear([{ ...PDF, tamano: 3_670_016 }]);

    expect(el().querySelector('.adj__peso')?.textContent?.trim()).toBe('3.5 MB');
  });
});
