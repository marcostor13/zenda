import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../icon/rs-icon.component';
import { environment } from '../../../../environments/environment';

interface ImageSlot {
  id: string;
  previewUrl: string;
  uploadedUrl: string | null;
  uploading: boolean;
  error: string;
  isBlob: boolean;
}

@Component({
  selector: 'rs-image-upload',
  standalone: true,
  imports: [RsIconComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RsImageUploadComponent),
      multi: true,
    },
  ],
  template: `
    <div
      class="upload-zone"
      [class.upload-zone--drag]="isDragging()"
      [class.upload-zone--has-images]="slots().length > 0"
      [class.upload-zone--disabled]="disabled"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave()"
      (drop)="onDrop($event)"
      (click)="slots().length === 0 && fileInput.click()">

      @if (slots().length === 0) {
        <div class="upload-placeholder">
          <div class="upload-placeholder__icon">
            <rs-icon name="upload" [size]="28" [stroke]="1.5"></rs-icon>
          </div>
          <p class="upload-hint">
            Arrastra {{ multiple ? 'imágenes' : 'una imagen' }} aquí o
            <button type="button" class="upload-link" (click)="fileInput.click()">haz clic para seleccionar</button>
          </p>
          <p class="upload-meta">JPEG, PNG, WebP · Max 5 MB{{ multiple ? ' · Hasta ' + maxFiles + ' imágenes' : '' }}</p>
        </div>
      } @else {
        <div class="image-grid" (click)="$event.stopPropagation()">
          @for (slot of slots(); track slot.id) {
            <div class="image-tile" [class.image-tile--error]="slot.error">
              <img [src]="slot.previewUrl" alt="Imagen subida" class="image-tile__img" />

              @if (slot.uploading) {
                <div class="image-tile__overlay">
                  <div class="spinner"></div>
                </div>
              }

              @if (slot.error && !slot.uploading) {
                <div class="image-tile__overlay image-tile__overlay--error">
                  <rs-icon name="alert-circle" [size]="18" [stroke]="2"></rs-icon>
                </div>
              }

              @if (!slot.uploading) {
                <button
                  type="button"
                  class="image-tile__remove"
                  title="Eliminar imagen"
                  (click)="removeSlot(slot.id)">
                  <rs-icon name="x" [size]="10" [stroke]="3"></rs-icon>
                </button>
              }
            </div>
          }

          @if (canAddMore()) {
            <button
              type="button"
              class="image-tile image-tile--add"
              title="Añadir imagen"
              (click)="fileInput.click()">
              <rs-icon name="plus" [size]="22" [stroke]="1.5" style="color:var(--t-400)"></rs-icon>
            </button>
          }
        </div>
      }
    </div>

    <input
      #fileInput
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      style="display:none"
      [multiple]="multiple"
      (change)="onFileChange($event)" />
  `,
  styles: [`
    :host { display: block; }

    .upload-zone {
      border: 2px dashed var(--b-2);
      border-radius: var(--r-xl);
      padding: var(--sp-8);
      cursor: pointer;
      transition: border-color var(--d-2), background var(--d-2);
      background: var(--c-raised);
      min-height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .upload-zone:hover { border-color: var(--c-accent); }
    .upload-zone--drag { border-color: var(--c-accent); background: var(--c-accent-lo); }
    .upload-zone--has-images { cursor: default; padding: var(--sp-5); }
    .upload-zone--disabled { opacity: .5; pointer-events: none; }

    .upload-placeholder {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-3);
      pointer-events: none;
    }
    .upload-placeholder__icon {
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--c-surface);
      display: flex; align-items: center; justify-content: center;
      color: var(--t-400);
    }
    .upload-hint { font-size: var(--f-sm); color: var(--t-300); pointer-events: all; }
    .upload-link {
      color: var(--c-accent); background: none; border: none;
      cursor: pointer; padding: 0; font-size: inherit; text-decoration: underline;
    }
    .upload-meta { font-size: var(--f-xs); color: var(--t-500); }

    .image-grid { display: flex; flex-wrap: wrap; gap: var(--sp-3); width: 100%; }

    .image-tile {
      position: relative; width: 96px; height: 96px;
      border-radius: var(--r-lg); overflow: hidden; flex-shrink: 0;
    }
    .image-tile__img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .image-tile__overlay {
      position: absolute; inset: 0;
      background: rgba(0,0,0,.55);
      display: flex; align-items: center; justify-content: center;
      color: #fff;
    }
    .image-tile__overlay--error { background: rgba(239,68,68,.5); }

    .image-tile__remove {
      position: absolute; top: 4px; right: 4px;
      width: 20px; height: 20px; border-radius: 50%;
      background: rgba(0,0,0,.7); border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: #fff; transition: background var(--d-1);
    }
    .image-tile__remove:hover { background: #DC2626; }

    .image-tile--add {
      border: 2px dashed var(--b-2);
      background: var(--c-raised);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all var(--d-2);
    }
    .image-tile--add:hover { border-color: var(--c-accent); background: var(--c-accent-lo); }

    .spinner {
      width: 22px; height: 22px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.3);
      border-top-color: #fff;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class RsImageUploadComponent
  implements ControlValueAccessor, OnInit, OnDestroy
{
  private readonly http = inject(HttpClient);

  @Input() multiple = false;
  @Input() maxFiles = 6;

  readonly isDragging = signal(false);
  readonly slots = signal<ImageSlot[]>([]);
  disabled = false;

  private blobUrls: string[] = [];
  private onChange: (v: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.blobUrls.forEach(u => URL.revokeObjectURL(u));
  }

  canAddMore(): boolean {
    return this.multiple && this.slots().length < this.maxFiles;
  }

  writeValue(value: string | string[] | null): void {
    if (!value) { this.slots.set([]); return; }
    const urls = Array.isArray(value) ? value : [value];
    this.slots.set(
      urls.filter(Boolean).map(url => ({
        id: this.uid(),
        previewUrl: url,
        uploadedUrl: url,
        uploading: false,
        error: '',
        isBlob: false,
      })),
    );
  }

  registerOnChange(fn: (v: string[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(): void { this.isDragging.set(false); }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    void this.processFiles(files);
  }

  onFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    void this.processFiles(files);
    input.value = '';
  }

  removeSlot(id: string): void {
    const slot = this.slots().find(s => s.id === id);
    if (slot?.isBlob) {
      URL.revokeObjectURL(slot.previewUrl);
      this.blobUrls = this.blobUrls.filter(u => u !== slot.previewUrl);
    }
    this.slots.update(s => s.filter(sl => sl.id !== id));
    this.emitValue();
    this.onTouched();
  }

  private async processFiles(files: File[]): Promise<void> {
    const filtered = files.filter(f => f.type.startsWith('image/'));
    if (!this.multiple) {
      await this.uploadFile(filtered[0]);
    } else {
      const remaining = this.maxFiles - this.slots().length;
      const toUpload = filtered.slice(0, remaining);
      await Promise.all(toUpload.map(f => this.uploadFile(f)));
    }
  }

  private async uploadFile(file: File): Promise<void> {
    if (!file) return;
    const id = this.uid();
    const previewUrl = URL.createObjectURL(file);
    this.blobUrls.push(previewUrl);

    const slot: ImageSlot = {
      id, previewUrl, uploadedUrl: null, uploading: true, error: '', isBlob: true,
    };

    if (!this.multiple) {
      this.slots.set([slot]);
    } else {
      this.slots.update(s => [...s, slot]);
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await firstValueFrom(
        this.http.post<{ url: string }>(`${environment.apiUrl}/upload/image`, formData),
      );
      this.slots.update(s =>
        s.map(sl => sl.id === id ? { ...sl, uploadedUrl: res.url, uploading: false } : sl),
      );
      this.emitValue();
      this.onTouched();
    } catch {
      this.slots.update(s =>
        s.map(sl => sl.id === id ? { ...sl, uploading: false, error: 'Error al subir' } : sl),
      );
    }
  }

  private emitValue(): void {
    const urls = this.slots()
      .filter(s => s.uploadedUrl && !s.error)
      .map(s => s.uploadedUrl!);
    this.onChange(urls);
  }

  private uid(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}
