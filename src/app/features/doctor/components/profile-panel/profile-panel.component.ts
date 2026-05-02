import { Component, EventEmitter, inject, Input, OnChanges, Output, signal, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
import { DoctorProfile } from '../../models/doctor.model';
import { DoctorApiService } from '../../services/doctor-api.service';

@Component({
  selector: 'app-profile-panel',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    DialogModule, InputTextModule, ButtonModule,
    AvatarModule, DividerModule, MessageModule
  ],
  template: `
<p-dialog
  [(visible)]="visible"
  [modal]="true"
  [draggable]="false"
  [resizable]="false"
  position="right"
  styleClass="cs-dialog profile-panel-dialog"
  [style]="{ width: '420px', height: '100vh', margin: '0', borderRadius: '0' }"
  [closable]="true"
  (onHide)="onHide()"
>
  <ng-template pTemplate="header">
    <span class="profile-panel-title">
      <i class="pi pi-user-edit"></i>
      Mon Profil
    </span>
  </ng-template>

  <div class="profile-panel-body">

    <!-- Avatar section -->
    <div class="avatar-section">
      <div class="avatar-wrap" (click)="fileInput.click()">
        <p-avatar
          [image]="previewUrl() || ''"
          [label]="initials()"
          shape="circle"
          size="xlarge"
          styleClass="profile-big-avatar"
        />
        <div class="avatar-overlay">
          <i class="pi pi-camera"></i>
        </div>
      </div>
      <input #fileInput type="file" accept="image/*" hidden />
      <div class="avatar-info">
        <span class="avatar-name">Dr. {{ profile?.firstName }} {{ profile?.lastName }}</span>
        <span class="avatar-email">{{ profile?.email }}</span>
        @if (profile?.numeroRPPS) {
          <span class="rpps-badge">RPPS: {{ profile?.numeroRPPS }}</span>
        }
      </div>
    </div>

    @if (successMsg()) {
      <p-message severity="success" [text]="successMsg()!" styleClass="w-full mb-3" />
    }
    @if (errorMsg()) {
      <p-message severity="error" [text]="errorMsg()!" styleClass="w-full mb-3" />
    }

    <p-divider />

    <!-- Edit form -->
    <form [formGroup]="form" (ngSubmit)="save()" class="profile-form">

      <div class="form-row">
        <div class="field">
          <label>Prénom</label>
          <input pInputText formControlName="firstName" placeholder="Prénom" />
        </div>
        <div class="field">
          <label>Nom</label>
          <input pInputText formControlName="lastName" placeholder="Nom" />
        </div>
      </div>

      <div class="field">
        <label>Email</label>
        <input pInputText formControlName="email" type="email" placeholder="email@domaine.com" />
      </div>

      <div class="field">
        <label>Téléphone</label>
        <input pInputText formControlName="phoneNumber" placeholder="+33 6 00 00 00 00" />
      </div>

      <div class="field">
        <label>Adresse</label>
        <input pInputText formControlName="address" placeholder="Adresse du cabinet" />
      </div>

      <div class="profile-actions">
        <p-button
          label="Annuler"
          severity="secondary"
          [outlined]="true"
          (onClick)="onHide()"
          [disabled]="saving()"
        />
        <p-button
          label="Enregistrer"
          icon="pi pi-check"
          type="submit"
          [loading]="saving()"
          [disabled]="form.pristine || form.invalid"
        />
      </div>
    </form>

    <!-- Status -->
    <p-divider />
    <div class="status-row">
      <span class="status-label">Statut du compte</span>
      <span class="status-value" [class.active]="profile?.isActive">
        <span class="status-dot"></span>
        {{ profile?.isActive ? 'Actif' : 'Inactif' }}
      </span>
    </div>
  </div>
</p-dialog>
  `,
  styles: [`
    ::ng-deep .profile-panel-dialog .p-dialog-header {
      background: #022c22; color: white;
      padding: 20px 24px; border-radius: 0;
    }
    ::ng-deep .profile-panel-dialog .p-dialog-content { padding: 0; }
    ::ng-deep .profile-panel-dialog { border-radius: 0 !important; }

    .profile-panel-title {
      display: flex; align-items: center; gap: 8px;
      font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700;
    }

    .profile-panel-body { padding: 24px; overflow-y: auto; height: calc(100vh - 64px); }

    .avatar-section {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      margin-bottom: 20px;
    }

    .avatar-wrap {
      position: relative; cursor: pointer; border-radius: 50%;
      &:hover .avatar-overlay { opacity: 1; }
    }

    ::ng-deep .profile-big-avatar {
      width: 96px !important; height: 96px !important;
      font-size: 32px !important;
      background: #022c22 !important; color: #34d399 !important;
      font-family: 'Sora', sans-serif; font-weight: 700;
    }

    .avatar-overlay {
      position: absolute; inset: 0; border-radius: 50%;
      background: rgba(0,0,0,0.5); color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; opacity: 0; transition: opacity 0.2s;
    }

    .avatar-info { text-align: center; }
    .avatar-name  { display: block; font-weight: 700; font-size: 16px; color: #111827; font-family: 'Sora', sans-serif; }
    .avatar-email { display: block; font-size: 13px; color: #6b7280; margin-top: 2px; }
    .rpps-badge {
      display: inline-block; margin-top: 6px;
      background: #d1fae5; color: #059669;
      padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;
    }

    .profile-form { display: flex; flex-direction: column; gap: 4px; }

    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    .field {
      display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;
      label { font-size: 13px; font-weight: 600; color: #374151; font-family: 'DM Sans', sans-serif; }
      input { width: 100%; }
    }

    .profile-actions {
      display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px;
    }

    .status-row {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 8px;
    }
    .status-label { font-size: 13px; color: #6b7280; }
    .status-value {
      display: flex; align-items: center; gap: 6px;
      font-size: 13px; font-weight: 600; color: #ef4444;
      &.active { color: #059669; }
    }
    .status-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: currentColor;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(5,150,105,0.4); }
      50%      { box-shadow: 0 0 0 6px rgba(5,150,105,0); }
    }
  `]
})
export class ProfilePanelComponent implements OnChanges {
  @Input() visible = false;
  @Input() profile: DoctorProfile | null = null;
  @Output() visibleChange   = new EventEmitter<boolean>();
  @Output() profileUpdated  = new EventEmitter<Partial<DoctorProfile>>();

  private api = inject(DoctorApiService);
  private fb  = inject(FormBuilder);

  saving     = signal(false);
  errorMsg   = signal<string | null>(null);
  successMsg = signal<string | null>(null);
  previewUrl = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    firstName:   ['', Validators.required],
    lastName:    ['', Validators.required],
    email:       ['', [Validators.required, Validators.email]],
    specialty:   [''],
    phoneNumber: [''],
    address:     [''],
  });

  ngOnChanges(changes: SimpleChanges) {
    if (changes['profile'] && this.profile) {
      this.form.patchValue(this.profile);
      this.form.markAsPristine();
    }
  }

  initials(): string {
    if (!this.profile) return 'DR';
    return `${this.profile.firstName?.[0] ?? ''}${this.profile.lastName?.[0] ?? ''}`.toUpperCase();
  }

  // onFileSelected(event: Event) {
  //   const file = (event.target as HTMLInputElement).files?.[0];
  //   if (!file) return;
  //   const reader = new FileReader();
  //   reader.onload = e => this.previewUrl.set(e.target?.result as string);
  //   reader.readAsDataURL(file);

  //   this.api.uploadAvatar(file).subscribe({
  //     next: res => {
  //       this.profileUpdated.emit({ avatarUrl: res.avatarUrl });
  //       this.successMsg.set('Photo de profil mise à jour.');
  //       setTimeout(() => this.successMsg.set(null), 3000);
  //     },
  //     error: () => this.errorMsg.set('Erreur lors du téléchargement.')
  //   });
  // }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.errorMsg.set(null);

    this.api.updateDoctorProfile(this.form.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.profileUpdated.emit(this.form.value);
        this.successMsg.set('Profil mis à jour avec succès.');
        this.form.markAsPristine();
        setTimeout(() => this.successMsg.set(null), 3000);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(err?.error?.message ?? 'Erreur lors de la mise à jour.');
      }
    });
  }

  onHide() {
    this.errorMsg.set(null);
    this.successMsg.set(null);
    this.visible = false;
    this.visibleChange.emit(false);
  }
}