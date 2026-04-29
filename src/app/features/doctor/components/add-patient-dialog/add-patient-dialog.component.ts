import { Component, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageModule } from 'primeng/message';
import { DoctorApiService } from '../../services/doctor-api.service';

@Component({
  selector: 'app-add-patient-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    DialogModule, InputTextModule, ButtonModule,
    SelectModule, DatePickerModule, MessageModule
  ],
  template: `
<p-dialog
  [(visible)]="visible"
  [modal]="true"
  [draggable]="false"
  [resizable]="false"
  styleClass="cs-dialog"
  header="Ajouter un patient"
  [style]="{ width: '520px' }"
  (onHide)="onHide()"
>
  <div class="add-patient-body">

    @if (errorMsg()) {
      <p-message severity="error" [text]="errorMsg()!" styleClass="w-full mb-3" />
    }

    <form [formGroup]="form" (ngSubmit)="submit()" class="patient-form">

      <div class="form-row">
        <div class="field">
          <label>Prénom <span class="req">*</span></label>
          <input pInputText formControlName="firstName" placeholder="Prénom" />
          @if (f['firstName'].touched && f['firstName'].errors?.['required']) {
            <small class="field-error">Requis</small>
          }
        </div>
        <div class="field">
          <label>Nom <span class="req">*</span></label>
          <input pInputText formControlName="lastName" placeholder="Nom" />
          @if (f['lastName'].touched && f['lastName'].errors?.['required']) {
            <small class="field-error">Requis</small>
          }
        </div>
      </div>

      <div class="field">
        <label>Email <span class="req">*</span></label>
        <input pInputText formControlName="email" type="email" placeholder="patient@email.com" />
        @if (f['email'].touched && f['email'].errors?.['email']) {
          <small class="field-error">Email invalide</small>
        }
      </div>

      <div class="form-row">
        <div class="field">
          <label>Date de naissance</label>
          <p-datepicker
            formControlName="dateOfBirth"
            dateFormat="dd/mm/yy"
            [showIcon]="true"
            placeholder="jj/mm/aaaa"
            styleClass="w-full"
          />
        </div>
        <div class="field">
          <label>Genre</label>
          <p-select
            formControlName="gender"
            [options]="genderOptions"
            placeholder="Sélectionner"
            styleClass="w-full"
          />
        </div>
      </div>

      <div class="form-row">
        <div class="field">
          <label>Téléphone</label>
          <input pInputText formControlName="phoneNumber" placeholder="+33 6 00 00 00 00" />
        </div>
        <div class="field">
          <label>Groupe sanguin</label>
          <p-select
            formControlName="bloodType"
            [options]="bloodTypeOptions"
            placeholder="Type sanguin"
            styleClass="w-full"
          />
        </div>
      </div>

      <div class="field">
        <label>Adresse</label>
        <input pInputText formControlName="address" placeholder="Adresse du patient" />
      </div>

      <div class="dialog-actions">
        <p-button label="Annuler" severity="secondary" [outlined]="true"
          (onClick)="onHide()" [disabled]="loading()" />
        <p-button label="Ajouter le patient" icon="pi pi-user-plus"
          type="submit" [loading]="loading()" [disabled]="form.invalid" />
      </div>
    </form>
  </div>
</p-dialog>
  `,
  styles: [`
    ::ng-deep .cs-dialog .p-dialog-header {
      background: #022c22; color: white;
      font-family: 'Sora', sans-serif; border-radius: 12px 12px 0 0;
    }
    .add-patient-body { padding: 20px 0 4px; }
    .patient-form { display: flex; flex-direction: column; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .field {
      display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px;
      label { font-size: 13px; font-weight: 600; color: #374151; font-family: 'DM Sans', sans-serif; }
      input { width: 100%; }
    }
    .req { color: #ef4444; }
    .field-error { color: #ef4444; font-size: 12px; }
    .dialog-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }
  `]
})
export class AddPatientDialogComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() patientAdded  = new EventEmitter<void>();

  private api = inject(DoctorApiService);
  private fb  = inject(FormBuilder);

  loading  = signal(false);
  errorMsg = signal<string | null>(null);

  genderOptions = [
    { label: 'Homme', value: 'MALE' },
    { label: 'Femme', value: 'FEMALE' },
    { label: 'Autre', value: 'OTHER' },
  ];

  bloodTypeOptions = ['A+','A-','B+','B-','AB+','AB-','O+','O-']
    .map(b => ({ label: b, value: b }));

  form: FormGroup = this.fb.group({
    firstName:   ['', Validators.required],
    lastName:    ['', Validators.required],
    email:       ['', [Validators.required, Validators.email]],
    dateOfBirth: [null],
    gender:      [null],
    phoneNumber: [''],
    bloodType:   [null],
    address:     [''],
  });

  get f() { return this.form.controls; }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.errorMsg.set(null);

    const raw = this.form.value;
    const payload = {
      ...raw,
      dateOfBirth: raw.dateOfBirth
        ? (raw.dateOfBirth as Date).toISOString().slice(0, 10)
        : null,
    };

    this.api.createPatient(payload).subscribe({
      next: () => {
        this.loading.set(false);
        this.patientAdded.emit();
        this.onHide();
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.message ?? 'Erreur lors de la création du patient.');
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