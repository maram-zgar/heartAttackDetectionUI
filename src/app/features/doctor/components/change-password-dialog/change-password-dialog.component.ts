import { Component, EventEmitter, inject, Input, OnInit, Output, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { DoctorApiService } from '../../services/doctor-api.service';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPwd  = control.get('newPassword')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return newPwd && confirm && newPwd !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    DialogModule, InputTextModule, PasswordModule, ButtonModule, MessageModule
  ],
  template: `
<p-dialog
  [(visible)]="visible"
  [modal]="true"
  [draggable]="false"
  [resizable]="false"
  styleClass="cs-dialog pwd-dialog"
  header="Changer le mot de passe"
  [style]="{ width: '440px' }"
  (onHide)="onHide()"
>
  <div class="dialog-body">

    <div class="pwd-icon-wrap">
      <i class="pi pi-lock"></i>
    </div>

    <p class="pwd-hint">
      Votre nouveau mot de passe doit contenir au minimum <strong>8 caractères</strong>,
      une majuscule, un chiffre et un caractère spécial.
    </p>

    @if (errorMsg()) {
      <p-message severity="error" [text]="errorMsg()!" styleClass="w-full mb-3" />
    }

    <form [formGroup]="form" (ngSubmit)="submit()" class="pwd-form" autocomplete="off">

      <div class="field">
        <label>Mot de passe actuel</label>
        <p-password
          formControlName="currentPassword"
          [feedback]="false"
          [toggleMask]="true"
          placeholder="••••••••"
          styleClass="w-full"
          inputStyleClass="w-full"
        />
        @if (f['currentPassword'].touched && f['currentPassword'].errors?.['required']) {
          <small class="field-error">Champ requis</small>
        }
      </div>

      <div class="field">
        <label>Nouveau mot de passe</label>
        <p-password
          formControlName="newPassword"
          [toggleMask]="true"
          placeholder="••••••••"
          styleClass="w-full"
          inputStyleClass="w-full"
          promptLabel="Entrez un mot de passe"
          weakLabel="Faible"
          mediumLabel="Moyen"
          strongLabel="Fort"
        />
        @if (f['newPassword'].touched && f['newPassword'].errors?.['minlength']) {
          <small class="field-error">Minimum 8 caractères</small>
        }
      </div>

      <div class="field">
        <label>Confirmer le mot de passe</label>
        <p-password
          formControlName="confirmPassword"
          [feedback]="false"
          [toggleMask]="true"
          placeholder="••••••••"
          styleClass="w-full"
          inputStyleClass="w-full"
        />
        @if (form.errors?.['mismatch'] && f['confirmPassword'].touched) {
          <small class="field-error">Les mots de passe ne correspondent pas</small>
        }
      </div>

      <div class="dialog-actions">
        <p-button
          label="Annuler"
          severity="secondary"
          [outlined]="true"
          (onClick)="onHide()"
          [disabled]="loading()"
        />
        <p-button
          label="Mettre à jour"
          type="submit"
          icon="pi pi-check"
          [loading]="loading()"
          [disabled]="form.invalid"
        />
      </div>
    </form>
  </div>
</p-dialog>
  `,
  styles: [`
    ::ng-deep .pwd-dialog .p-dialog-header {
      background: var(--sidebar-bg, #022c22);
      color: white;
      border-radius: 12px 12px 0 0;
      font-family: 'Sora', sans-serif;
    }
    ::ng-deep .pwd-dialog .p-dialog-content { padding: 0; border-radius: 0 0 12px 12px; }

    .dialog-body { padding: 24px; }

    .pwd-icon-wrap {
      width: 56px; height: 56px; border-radius: 14px;
      background: #d1fae5; color: #059669;
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; margin: 0 auto 16px;
    }

    .pwd-hint {
      font-size: 13px; color: #6b7280; text-align: center;
      margin: 0 0 20px; line-height: 1.6;
      font-family: 'DM Sans', sans-serif;
    }

    .pwd-form { display: flex; flex-direction: column; gap: 4px; }

    .field {
      display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px;
      label { font-size: 13px; font-weight: 600; color: #374151; font-family: 'DM Sans', sans-serif; }
    }

    .field-error { color: #ef4444; font-size: 12px; margin-top: 2px; }

    .dialog-actions {
      display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px;
    }
  `]
})
export class ChangePasswordDialogComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() passwordChanged = new EventEmitter<void>();

  private api = inject(DoctorApiService);
  private fb  = inject(FormBuilder);

  loading  = signal(false);
  errorMsg = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    currentPassword:  ['', Validators.required],
    newPassword:      ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword:  ['', Validators.required],
  }, { validators: passwordMatchValidator });

  get f() { return this.form.controls; }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.errorMsg.set(null);

    this.api.changePassword({
      currentPassword: this.f['currentPassword'].value,
      newPassword:     this.f['newPassword'].value,
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.passwordChanged.emit();
        this.onHide();
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(
          err?.error?.message ?? 'Mot de passe actuel incorrect.'
        );
      }
    });
  }

  onHide() {
    this.form.reset();
    this.errorMsg.set(null);
    this.visible = false;
    this.visibleChange.emit(false);
  }
}