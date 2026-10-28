import { desplazarASeccion } from './desplazar-a-seccion';

describe('desplazarASeccion', () => {
  let scrollTo: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    scrollTo = jest.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    document.body.innerHTML = '<div id="espacios"></div>';
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  function situarSeccion(top: number): void {
    const seccion = document.getElementById('espacios')!;
    seccion.getBoundingClientRect = () => ({ top } as DOMRect);
  }

  it('debería devolver false si la sección no existe', () => {
    expect(desplazarASeccion('no-existe')).toBe(false);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('debería desplazar suavemente hasta la sección', () => {
    situarSeccion(500);
    expect(desplazarASeccion('espacios')).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'smooth' });
  });

  it('debería completar el salto si la sección se movió durante el recorrido', () => {
    situarSeccion(500);
    desplazarASeccion('espacios');
    situarSeccion(120);
    jest.advanceTimersByTime(700);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 120 });
  });

  it('no debería corregir si el desplazamiento llegó a su sitio', () => {
    situarSeccion(500);
    desplazarASeccion('espacios');
    situarSeccion(0);
    jest.advanceTimersByTime(700);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});
