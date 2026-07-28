import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RsChipComponent } from './rs-chip.component';

describe('RsChipComponent', () => {
  let fixture: ComponentFixture<RsChipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RsChipComponent] }).compileComponents();
    fixture = TestBed.createComponent(RsChipComponent);
  });

  it('aplica la clase activa cuando active=true', () => {
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();

    const btn = fixture.debugElement.query(By.css('button'));
    expect(btn.nativeElement.classList).toContain('rs-chip--active');
    expect(btn.nativeElement.getAttribute('aria-pressed')).toBe('true');
  });

  it('emite chipClick al pulsar', () => {
    fixture.detectChanges();
    let emitido = false;
    fixture.componentInstance.chipClick.subscribe(() => (emitido = true));

    fixture.debugElement.query(By.css('button')).nativeElement.click();

    expect(emitido).toBe(true);
  });
});
