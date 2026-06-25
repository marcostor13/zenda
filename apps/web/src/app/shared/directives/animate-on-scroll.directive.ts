import { Directive, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';

@Directive({ selector: '[rsAnim]', standalone: true })
export class AnimateOnScrollDirective implements OnInit, OnDestroy {
  @Input() rsAnim = '';
  @Input() rsAnimDelay = 0;

  private observer!: IntersectionObserver;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    const el = this.el.nativeElement;
    el.classList.add('rs-anim');
    if (this.rsAnim) el.classList.add(`rs-anim--${this.rsAnim}`);
    if (this.rsAnimDelay > 0) el.style.transitionDelay = `${this.rsAnimDelay}ms`;

    this.observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); this.observer.disconnect(); } },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    this.observer.observe(el);
  }

  ngOnDestroy(): void { this.observer?.disconnect(); }
}
