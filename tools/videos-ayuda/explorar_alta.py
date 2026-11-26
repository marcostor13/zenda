"""Recorre el alta de servicio del comercio en local, volcando cada sub-paso."""
from playwright.sync_api import sync_playwright
from comun import contexto_navegador, BASE_WEB, RAIZ_SALIDA
from explorar_util import volcar
out = RAIZ_SALIDA / '_explorar'

def botones(pg):
    print('BOTONES', [t.strip().replace('\n', ' ')[:50] for t in pg.locator('button').all_inner_texts() if t.strip()][-30:])

def continuar(pg, nombre):
    pg.get_by_role('button', name='Continuar').click()
    volcar(pg, nombre, out, 1500); botones(pg)

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = contexto_navegador(b, out / 'sesion-comercio.json'); pg = ctx.new_page(); pg.set_default_timeout(8000)
    pg.goto(BASE_WEB + '/comercio/alta', wait_until='networkidle'); pg.wait_for_timeout(1000)
    pg.get_by_text('Peluquerías caninas').first.click(); pg.get_by_role('button', name='Continuar').click(); pg.wait_for_timeout(1500)
    pg.locator('[formcontrolname=titulo]').fill('Peludos Salón Canino')
    pg.locator('[formcontrolname=descripcion]').fill('Peluquería canina en el centro de Valencia: baño, corte de raza y spa con productos naturales y mucha paciencia.')
    pg.get_by_role('button', name='Continuar').click(); pg.wait_for_timeout(1200)
    calle = pg.locator('[formcontrolname=calle] input'); calle.click(); calle.press_sequentially('Calle de Colón 20, Valencia', delay=30); pg.wait_for_timeout(2500)
    pg.get_by_role('option').filter(has_text='46004').first.click(); pg.wait_for_timeout(2000)
    pg.locator('[formcontrolname=precioBase]').fill('25')
    continuar(pg, 'alta-horarios')
    continuar(pg, 'alta-detalles')
    continuar(pg, 'alta-perros')
    continuar(pg, 'alta-paso3')
    b.close()
