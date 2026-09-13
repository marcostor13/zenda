import { TestBed } from '@angular/core/testing';
import { HistorialTimelineComponent } from './historial-timeline.component';
import { RegistroServicioApi } from '../expediente.service';

describe('HistorialTimelineComponent', () => {
  const registro = (id: string, vertical: string, fecha: string): RegistroServicioApi => ({
    _id: id, vertical, origen: 'comercio', titulo: `Registro ${id}`, nota: `Registro ${id}`,
    datosEstructurados: {}, fechaServicio: fecha, esPropio: false,
  });

  const crear = (registros: RegistroServicioApi[]) => {
    TestBed.configureTestingModule({ imports: [HistorialTimelineComponent] });
    const fixture = TestBed.createComponent(HistorialTimelineComponent);
    fixture.componentRef.setInput('registros', registros);
    fixture.detectChanges();
    return fixture;
  };

  it('debería mostrar el estado vacío sin registros', () => {
    const fixture = crear([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Todavía no hay registros en el historial.');
  });

  it('debería agrupar por año, del más reciente al más antiguo', () => {
    const fixture = crear([
      registro('a', 'veterinaria', '2025-05-01'),
      registro('b', 'peluqueria', '2026-02-01'),
      registro('c', 'veterinaria', '2026-08-01'),
    ]);

    expect(fixture.componentInstance.grupos().map((g) => g.ano)).toEqual([2026, 2025]);
    expect(fixture.componentInstance.categorias()).toHaveLength(2);
  });

  it('debería filtrar por categoría', () => {
    const fixture = crear([registro('a', 'veterinaria', '2026-05-01'), registro('b', 'peluqueria', '2026-02-01')]);

    fixture.componentInstance.filtro.set('peluqueria');
    fixture.detectChanges();

    const ids = fixture.componentInstance.grupos().flatMap((g) => g.registros.map((r) => r._id));
    expect(ids).toEqual(['b']);
  });
});
