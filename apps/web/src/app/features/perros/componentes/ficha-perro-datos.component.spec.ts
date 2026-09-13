import { TestBed } from '@angular/core/testing';
import { FichaPerroDatosComponent } from './ficha-perro-datos.component';
import { PerroApi } from '../perros.service';

describe('FichaPerroDatosComponent', () => {
  const perro = (extra: Partial<PerroApi> = {}): PerroApi => ({
    _id: 'p1', nombre: 'Nala', fotos: [], especie: 'perro', raza: 'Beagle', esMestizo: false, esterilizado: true,
    tipoPelo: ['corto'], vacunas: ['Rabia'], vacunasDetalle: [{ tipo: 'antirrabica' as never, fecha: '2026-01-01' }],
    alergias: ['Pollo'], enfermedades: [], medicacion: [], puedeQuedarseSolo: true, ansiedadSeparacion: true,
    miedos: ['Tormentas'], seMarea: false, requiereTransportin: false, autorizaCompartirHistorial: true,
    peso: 12, sexo: 'hembra', tamano: 'mediano', microchip: '941', dieta: 'Pienso', temperamento: 'Tranquila',
    sociabilidadPerros: 'alta', notasAlojamiento: 'Duerme con manta', cartillaSanitariaUrl: 'https://x/cartilla.pdf',
    certificadosUrl: ['https://x/cert.pdf'],
    ...extra,
  });

  const crear = (datos: PerroApi, secciones?: string[]) => {
    TestBed.configureTestingModule({ imports: [FichaPerroDatosComponent] });
    const fixture = TestBed.createComponent(FichaPerroDatosComponent);
    fixture.componentRef.setInput('perro', datos);
    if (secciones) fixture.componentRef.setInput('secciones', secciones);
    fixture.detectChanges();
    return fixture;
  };

  it('debería pintar todas las secciones con los datos del dueño', () => {
    const fixture = crear(perro());
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('Beagle');
    expect(texto).toContain('Antirrábica');
    expect(texto).toContain('Pollo');
    expect(texto).toContain('Ansiedad por separación');
    expect(texto).toContain('Tormentas');
    expect(texto).toContain('Duerme con manta');
    expect(texto).toContain('Cartilla sanitaria');
    expect(fixture.componentInstance.documentos()).toHaveLength(2);
  });

  it('debería pintar sólo las secciones pedidas y avisar de lo que falta', () => {
    const fixture = crear(perro({ vacunas: [], vacunasDetalle: [], cartillaSanitariaUrl: undefined, certificadosUrl: [] }), ['salud', 'documentos']);
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(texto).not.toContain('Datos generales');
    expect(texto).toContain('Sin vacunas registradas');
    expect(texto).toContain('No hay documentos subidos');
  });

  it('debería marcar como mestizo a un perro sin raza y omitir datos vacíos', () => {
    const fixture = crear(perro({ raza: undefined, esMestizo: true, microchip: undefined, ciudad: undefined }));
    const general = fixture.componentInstance.general();

    expect(general.find((f) => f.etiqueta === 'Raza')?.valor).toBe('Mestizo');
    expect(general.find((f) => f.etiqueta === 'Microchip')).toBeUndefined();
  });
});
