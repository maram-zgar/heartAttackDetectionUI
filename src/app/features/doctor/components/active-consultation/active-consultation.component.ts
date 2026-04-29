import {
  Component, EventEmitter, inject, Input, OnInit,
  Output, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { DoctorApiService } from '../../services/doctor-api.service';
import { DoctorStateService } from '../../services/doctor-state.service';
import {
  PatientResponse, MedicalFileResponse,
  VitalsRecord, RiskLevel
} from '../../models/doctor.model';

type TagSeverity = "success" | "info" | "warn" | "danger" | "secondary" | "contrast" | null | undefined;

const RISK_CONFIG: Record<RiskLevel, { label: string; severity: TagSeverity; color: string; icon: string }> = {
  LOW:      { label: 'Risque Faible',    severity: 'success', color: '#059669', icon: 'pi-check-circle' },
  MODERATE: { label: 'Risque Modéré',   severity: 'warn',    color: '#d97706', icon: 'pi-exclamation-triangle' },
  HIGH:     { label: 'Risque Élevé',    severity: 'danger',  color: '#ef4444', icon: 'pi-times-circle' },
  CRITICAL: { label: 'Risque Critique', severity: 'danger',  color: '#7f1d1d', icon: 'pi-ban' },
};

@Component({
  selector: 'app-active-consultation',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    ButtonModule, InputNumberModule, TextareaModule,
    CardModule, TagModule, DividerModule,
    ProgressBarModule, MessageModule, SkeletonModule, TooltipModule
  ],
  template: `
<div class="consultation-layout">

  <!-- ── LEFT: Vitals form + Prediction ── -->
  <div class="consultation-left">

    <!-- Vitals form -->
    <div class="cs-card">
      <div class="cs-card-header">
        <i class="pi pi-heart-fill header-icon vitals-icon"></i>
        <h3>Saisie des constantes vitales</h3>
      </div>

      <form [formGroup]="vitalsForm" (ngSubmit)="submitVitals()" class="vitals-form">
        <div class="vitals-grid">

          <div class="vital-field">
            <label>
              <i class="pi pi-heart"></i>
              Fréquence cardiaque
              <span class="unit">bpm</span>
            </label>
            <p-inputnumber
              formControlName="heartRate"
              [min]="30" [max]="250"
              placeholder="72"
              styleClass="w-full"
            />
          </div>

          <div class="vital-field">
            <label>
              <i class="pi pi-arrow-up"></i>
              TA Systolique
              <span class="unit">mmHg</span>
            </label>
            <p-inputnumber
              formControlName="systolicBP"
              [min]="60" [max]="250"
              placeholder="120"
              styleClass="w-full"
            />
          </div>

          <div class="vital-field">
            <label>
              <i class="pi pi-arrow-down"></i>
              TA Diastolique
              <span class="unit">mmHg</span>
            </label>
            <p-inputnumber
              formControlName="diastolicBP"
              [min]="40" [max]="150"
              placeholder="80"
              styleClass="w-full"
            />
          </div>

          <div class="vital-field">
            <label>
              <i class="pi pi-sun"></i>
              Température
              <span class="unit">°C</span>
            </label>
            <p-inputnumber
              formControlName="temperature"
              [min]="34" [max]="43"
              [minFractionDigits]="1" [maxFractionDigits]="1"
              placeholder="37.0"
              styleClass="w-full"
            />
          </div>

          <div class="vital-field">
            <label>
              <i class="pi pi-cloud"></i>
              Saturation O₂
              <span class="unit">%</span>
            </label>
            <p-inputnumber
              formControlName="oxygenSaturation"
              [min]="50" [max]="100"
              placeholder="98"
              styleClass="w-full"
            />
          </div>

          <div class="vital-field">
            <label>
              <i class="pi pi-user"></i>
              Poids
              <span class="unit">kg</span>
            </label>
            <p-inputnumber
              formControlName="weight"
              [min]="1" [max]="300"
              [minFractionDigits]="1"
              placeholder="70.0"
              styleClass="w-full"
            />
          </div>
        </div>

        <p-button
          label="Analyser & Prédire le risque"
          icon="pi pi-bolt"
          type="submit"
          styleClass="w-full mt-3"
          [loading]="analyzingVitals()"
          [disabled]="vitalsForm.invalid"
        />
      </form>
    </div>

    <!-- Risk prediction result -->
    @if (latestVitals(); as vitals) {
      @let config = riskConfig(vitals.riskLevel || 'LOW');
      <div class="cs-card prediction-card" [class]="'risk-' + latestVitals()!.riskLevel?.toLowerCase()">
        <div class="prediction-header">
          <i [class]="'pi ' + riskConfig(latestVitals()!.riskLevel!).icon + ' risk-icon'"></i>
          <div>
            <h3 class="risk-label">{{ riskConfig(latestVitals()!.riskLevel!).label }}</h3>
            <span class="risk-score-text">Score: {{ latestVitals()!.riskScore }}/100</span>
          </div>
          <p-tag
            [value]="riskConfig(latestVitals()!.riskLevel!).label"
            [severity]="riskConfig(latestVitals()!.riskLevel!).severity"
            styleClass="ml-auto"
          />
        </div>
        <p-progressbar
          [value]="latestVitals()!.riskScore ?? 0"
          [style]="{ height: '10px', marginTop: '12px' }"
          styleClass="risk-progress"
        />
        <div class="vitals-summary">
          <div class="vs-item">
            <span class="vs-label">Tension</span>
            <span class="vs-val">{{ vitals.restingbloodPressure }} mmHg</span>
          </div>
          <div class="vs-item">
            <span class="vs-label">FC Max (Thalach)</span>
            <span class="vs-val">{{ vitals.thalach }} bpm</span>
          </div>
          <div class="vs-item">
            <span class="vs-label">Cholestérol</span>
            <span class="vs-val">{{ vitals.cholesterol }} mg/dL</span>
          </div>
          <div class="vs-item">
            <span class="vs-label">Vaisseaux (CA)</span>
            <span class="vs-val">{{ vitals.ca }}</span>
          </div>
          <div class="vs-item">
            <span class="vs-label">ST Depression</span>
            <span class="vs-val">{{ vitals.oldpeak }}</span>
          </div>
        </div>
      </div>
    }
  </div>

  <!-- ── RIGHT: Notes + Dossier + End consultation ── -->
  <div class="consultation-right">

    <!-- Consultation notes -->
    <div class="cs-card">
      <div class="cs-card-header">
        <i class="pi pi-file-edit header-icon notes-icon"></i>
        <h3>Notes de consultation</h3>
        @if (noteSaved()) {
          <span class="saved-chip"><i class="pi pi-check"></i> Sauvegardé</span>
        }
      </div>

      <form [formGroup]="noteForm" (ngSubmit)="saveNote()">
        <textarea
          pTextarea
          formControlName="content"
          rows="8"
          placeholder="Observations, diagnostics, prescriptions, recommandations…"
          class="notes-textarea"
          autoResize="true"
        ></textarea>
        <div class="note-actions">
          <p-button
            label="Ajouter au dossier"
            icon="pi pi-save"
            type="submit"
            severity="secondary"
            [outlined]="true"
            [loading]="savingNote()"
            [disabled]="noteForm.invalid || noteForm.pristine"
          />
        </div>
      </form>
    </div>

    <!-- Saved notes list -->
    @if (savedNotes().length > 0) {
      <div class="cs-card notes-history">
        <div class="cs-card-header">
          <i class="pi pi-history header-icon"></i>
          <h3>Notes enregistrées</h3>
        </div>
        @for (note of savedNotes(); track note.id) {
          <div class="note-item">
            <div class="note-meta">
              <span class="note-author">{{ note.authorName }}</span>
              <span class="note-date">{{ note.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
            </div>
            <p class="note-content">{{ note.content }}</p>
          </div>
        }
      </div>
    }

    <!-- End consultation -->
    <div class="cs-card end-card">
      <div class="cs-card-header">
        <i class="pi pi-check-square header-icon end-icon"></i>
        <h3>Terminer la consultation</h3>
      </div>
      <p class="end-hint">
        La consultation sera marquée comme terminée, le dossier médical du patient mis à jour,
        et le rendez-vous retiré de l'agenda.
      </p>
      <p-button
        label="Marquer comme terminée"
        icon="pi pi-check"
        severity="success"
        styleClass="w-full"
        [loading]="completing()"
        (onClick)="endConsultation()"
      />
    </div>
  </div>
</div>
  `,
  styles: [`
    .consultation-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      @media (max-width: 900px) { grid-template-columns: 1fr; }
    }

    .consultation-left, .consultation-right {
      display: flex; flex-direction: column; gap: 16px;
    }

    .cs-card {
      background: var(--card-bg, #fff);
      border: 1px solid var(--card-border, #e5e7eb);
      border-radius: 12px;
      padding: 20px;
    }

    .cs-card-header {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 18px;
      h3 { margin: 0; font-family: 'Sora', sans-serif; font-size: 16px;
           font-weight: 700; color: var(--text-primary, #111827); }
    }

    .header-icon {
      width: 36px; height: 36px; border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
    }
    .vitals-icon { background: #fee2e2; color: #ef4444; }
    .notes-icon  { background: #dbeafe; color: #3b82f6; }
    .end-icon    { background: #d1fae5; color: #059669; }

    .saved-chip {
      margin-left: auto; background: #d1fae5; color: #059669;
      padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;
      display: flex; align-items: center; gap: 4px;
    }

    /* Vitals */
    .vitals-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
    }

    .vital-field {
      display: flex; flex-direction: column; gap: 6px;
      label {
        font-size: 12px; font-weight: 600; color: #6b7280;
        text-transform: uppercase; letter-spacing: 0.4px;
        display: flex; align-items: center; gap: 5px;
        font-family: 'DM Sans', sans-serif;
        .pi { font-size: 12px; color: #ef4444; }
      }
    }

    .unit { color: #9ca3af; font-size: 11px; margin-left: auto; font-weight: 400; text-transform: none; }

    .w-full { width: 100%; }
    .mt-3   { margin-top: 12px; }

    /* Prediction card */
    .prediction-card {
      border-left: 4px solid #e5e7eb;
      &.risk-low      { border-left-color: #059669; }
      &.risk-moderate { border-left-color: #d97706; }
      &.risk-high     { border-left-color: #ef4444; }
      &.risk-critical { border-left-color: #7f1d1d; background: #fff1f2; }
    }

    .prediction-header {
      display: flex; align-items: center; gap: 12px;
    }

    .risk-icon { font-size: 28px; }
    .risk-label { font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700; margin: 0; color: var(--text-primary, #111827); }
    .risk-score-text { font-size: 13px; color: #6b7280; }
    .ml-auto { margin-left: auto; }

    ::ng-deep .risk-progress .p-progressbar-value { background: #ef4444; }

    .vitals-summary {
      display: flex; gap: 16px; margin-top: 14px; flex-wrap: wrap;
    }

    .vs-item { display: flex; flex-direction: column; gap: 2px; }
    .vs-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; }
    .vs-val   { font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700; color: var(--text-primary, #111827); }

    /* Notes */
    .notes-textarea {
      width: 100%; border: 1px solid var(--card-border, #e5e7eb);
      border-radius: 8px; padding: 12px; font-family: 'DM Sans', sans-serif;
      font-size: 14px; resize: vertical; min-height: 160px;
      background: var(--card-bg, #fff); color: var(--text-primary, #111827);
      transition: border-color 0.2s;
      &:focus { border-color: #059669; outline: none; }
    }

    .note-actions { display: flex; justify-content: flex-end; margin-top: 10px; }

    .notes-history { max-height: 280px; overflow-y: auto; }

    .note-item {
      border-bottom: 1px solid var(--card-border, #f3f4f6);
      padding: 12px 0;
      &:last-child { border-bottom: none; }
    }
    .note-meta { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .note-author { font-weight: 600; font-size: 13px; color: var(--text-primary, #111827); }
    .note-date   { font-size: 12px; color: #9ca3af; }
    .note-content {
      font-size: 14px; color: #4b5563; margin: 0; line-height: 1.6;
      font-family: 'DM Sans', sans-serif;
    }

    /* End card */
    .end-hint {
      font-size: 13px; color: #6b7280; line-height: 1.6; margin: 0 0 16px;
      font-family: 'DM Sans', sans-serif;
    }
  `]
})
export class ActiveConsultationComponent implements OnInit {
  @Input({ required: true }) patient!: PatientResponse;
  @Output() consultationCompleted = new EventEmitter<void>();

  private api   = inject(DoctorApiService);
  private state = inject(DoctorStateService);
  private fb    = inject(FormBuilder);

  medicalFile    = signal<MedicalFileResponse | null>(null);
  latestVitals   = signal<VitalsRecord | null>(null);
  savedNotes     = computed(() => this.medicalFile()?.notes ?? []);

  analyzingVitals = signal(false);
  savingNote      = signal(false);
  noteSaved       = signal(false);
  completing      = signal(false);

  vitalsForm = this.fb.group({
  age: [null as number | null, [Validators.required, Validators.min(1), Validators.max(120)]],
  gender: [true, [Validators.required]], // boolean: true = Male, false = Female
  chestPain: [0, [Validators.required, Validators.min(0), Validators.max(3)]], // 4 values (0-3)
  restingbloodPressure: [null as number | null, [Validators.required, Validators.min(60), Validators.max(250)]],
  cholesterol: [null as number | null, [Validators.required, Validators.min(100), Validators.max(600)]],
  fastingBloodSugar: [0, [Validators.required]], // 0 or 1
  restingECG: [0, [Validators.required, Validators.min(0), Validators.max(2)]], // values 0,1,2
  thalach: [null as number | null, [Validators.required, Validators.min(60), Validators.max(220)]], // Max HR
  exang: [false, [Validators.required]], // exercise induced angina (boolean)
  oldpeak: [0 as number | null, [Validators.required, Validators.min(0), Validators.max(10)]], // ST depression
  slope: [0, [Validators.required, Validators.min(0), Validators.max(2)]],
  ca: [0, [Validators.required, Validators.min(0), Validators.max(3)]], // major vessels
  thal: [0, [Validators.required, Validators.min(0), Validators.max(2)]], // thal
});

  noteForm = this.fb.group({
    content: ['', [Validators.required, Validators.minLength(2)]],
  });

  ngOnInit() {
    this.api.getMedicalFile(this.patient.id).subscribe({
      next: file => this.medicalFile.set(file),
      error: () => {}   // new patients may not have a file yet
    });
  }

  submitVitals() {
    if (this.vitalsForm.invalid) { this.vitalsForm.markAllAsTouched(); return; }
    this.analyzingVitals.set(true);

    const fileId = this.medicalFile()?.id;
    if (!fileId) { this.analyzingVitals.set(false); return; }

    const raw = this.vitalsForm.value;
    const payload = {
      age:                  raw.age!,
      gender:               raw.gender!, // true = male, false = female
      chestPain:            raw.chestPain!,
      restingbloodPressure: raw.restingbloodPressure!, // matches model
      cholesterol:          raw.cholesterol!,
      fastingBloodSugar:    raw.fastingBloodSugar!,
      restingECG:           raw.restingECG!,
      thalach:              raw.thalach!, // heart rate
      exang:                raw.exang!,
      oldpeak:              raw.oldpeak!,
      slope:                raw.slope!,
      ca:                   raw.ca!,
      thal:                 raw.thal!,
    };
    this.api.addVitals(fileId, payload).subscribe({
      next: (vitalsRecord) => {
        this.latestVitals.set(vitalsRecord);
        this.analyzingVitals.set(false);
        // Refresh medical file
        this.api.getMedicalFile(this.patient.id).subscribe(f => this.medicalFile.set(f));
      },
      error: () => this.analyzingVitals.set(false)
    });
  }

  saveNote() {
    if (this.noteForm.invalid) return;
    const fileId = this.medicalFile()?.id;
    if (!fileId) return;

    this.savingNote.set(true);
    this.api.addNote(fileId, { content: this.noteForm.value.content! }).subscribe({
      next: () => {
        this.savingNote.set(false);
        this.noteSaved.set(true);
        this.noteForm.reset();
        setTimeout(() => this.noteSaved.set(false), 3000);
        this.api.getMedicalFile(this.patient.id).subscribe(f => this.medicalFile.set(f));
      },
      error: () => this.savingNote.set(false)
    });
  }

  endConsultation() {
    if (!confirm('Confirmer la fin de la consultation ?')) return;
    this.completing.set(true);

    const doctor  = this.state.doctorProfile();
    // Find the active appointment for this patient
    const appt = this.state.appointments().find(a =>
      a.patientId === this.patient.id && a.status === 'ACCEPTED'
    );

    if (!appt || !doctor) { this.completing.set(false); return; }

    this.api.completeConsultation({
      appointmentId:    appt.id,
      patientId:        this.patient.id,
      patientEmail:     this.patient.email,
      patientFirstName: this.patient.firstName,
      doctorId:         doctor.id,
      doctorEmail:      doctor.email,
    }).subscribe({
      next: () => {
        this.state.updateAppointmentStatus(appt.id, 'COMPLETED');
        this.completing.set(false);
        this.consultationCompleted.emit();
      },
      error: () => this.completing.set(false)
    });
  }

  riskConfig(level: RiskLevel) {
    return RISK_CONFIG[level] ?? RISK_CONFIG.LOW;
  }
}