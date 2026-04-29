import {
  Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { TimelineModule } from 'primeng/timeline';
import { DoctorApiService } from '../../services/doctor-api.service';
import { MedicalFileResponse, RiskLevel, VitalsRecord } from '../../models/doctor.model';
import { DoctorStateService } from '../../services/doctor-state.service';

const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: '#059669', MODERATE: '#d97706', HIGH: '#ef4444', CRITICAL: '#7f1d1d'
};

@Component({
  selector: 'app-medical-file',
  standalone: true,
  imports: [
    CommonModule, ButtonModule, TabsModule,
    TagModule, SkeletonModule, DividerModule,
    TimelineModule
  ],
  template: `
<div class="medical-file-content">

  @if (loading()) {
    <div class="mf-loading">
      @for (i of [1,2,3]; track i) { <p-skeleton height="80px" styleClass="mb-3" /> }
    </div>
  } @else if (!file()) {
    <div class="mf-empty">
      <i class="pi pi-folder-open"></i>
      <p>Aucun dossier médical trouvé pour ce patient.</p>
    </div>
  } @else {

    <!-- Patient summary banner -->
    <div class="patient-banner">
      <div class="patient-avatar-lg">
        {{ patientInitials() }}
      </div>
      <div class="patient-banner-info">
        <h2>{{ file()!.patientFirstName }} {{ file()!.patientLastName }}</h2>
        <div class="banner-meta">
          <span>Dossier créé le {{ file()!.createdAt | date:'dd/MM/yyyy' }}</span>
          <span class="meta-sep">•</span>
          <span>Mis à jour {{ file()!.updatedAt | date:'dd/MM/yyyy' }}</span>
          <span class="meta-sep">•</span>
          <span>{{ file()!.consultations.length }} consultation(s)</span>
        </div>
      </div>
    </div>

    <p-tabs styleClass="mf-tabs">

      <!-- ── Consultations ── -->
      <p-tabpanel value="0" header="Consultations">
        @if (file()!.consultations.length === 0) {
          <div class="mf-empty-tab">
            <i class="pi pi-calendar-times"></i>
            <p>Aucune consultation enregistrée.</p>
          </div>
        }
        <p-timeline [value]="file()!.consultations" styleClass="mf-timeline">
          <ng-template pTemplate="marker" let-c>
            <div class="timeline-marker">
              <i class="pi pi-heart"></i>
            </div>
          </ng-template>
          <ng-template pTemplate="content" let-c>
            <div class="consultation-entry">
              <div class="entry-header">
                <span class="entry-date">{{ c.date | date:'dd/MM/yyyy' }}</span>
                <span class="entry-doctor">Dr. {{ c.doctorFirstName }} {{ c.doctorLastName }}</span>
              </div>
              @if (c.diagnosis) {
                <div class="entry-section">
                  <span class="entry-label">Diagnostic</span>
                  <p class="entry-text">{{ c.diagnosis }}</p>
                </div>
              }
              @if (c.prescription) {
                <div class="entry-section">
                  <span class="entry-label">Prescription</span>
                  <p class="entry-text">{{ c.prescription }}</p>
                </div>
              }
              @if (c.notes) {
                <div class="entry-section">
                  <span class="entry-label">Notes</span>
                  <p class="entry-text">{{ c.notes }}</p>
                </div>
              }
            </div>
          </ng-template>
        </p-timeline>
      </p-tabpanel>

      <!-- ── Vitals history ── -->
      <p-tabpanel value="1" header="Constantes vitales">
        @if (file()!.vitals.length === 0) {
          <div class="mf-empty-tab">
            <i class="pi pi-chart-line"></i>
            <p>Aucune constante enregistrée.</p>
          </div>
        }
        <div class="vitals-history">
          @for (v of file()!.vitals; track v.id) {
            <div class="vitals-entry" [class]="'risk-border-' + (v.riskLevel?.toLowerCase() ?? 'none')">
              <div class="ve-date">{{ v.recordedAt | date:'dd/MM/yyyy HH:mm' }}</div>
              <div class="ve-grid">
                <div class="ve-item"><span class="ve-label">Chest Pain</span><span class="ve-val">{{ v.chestPain }}</span></div>
                <div class="ve-item"><span class="ve-label">Resting Blood Pressure</span><span class="ve-val">{{ v.restingbloodPressure }}</span></div>
                <div class="ve-item"><span class="ve-label">Cholesterol</span><span class="ve-val">{{ v.cholesterol }}</span></div>
                <div class="ve-item"><span class="ve-label">Fasting Blood Sugar</span><span class="ve-val">{{ v.fastingBloodSugar }}</span></div>
                <div class="ve-item"><span class="ve-label">Resting ECG</span><span class="ve-val">{{ v.restingECG }}</span></div>
                <div class="ve-item"><span class="ve-label">Thalach</span><span class="ve-val">{{ v.thalach }}</span></div>
                <div class="ve-item"><span class="ve-label">Exercise Induced Angina</span><span class="ve-val">{{ v.exang ? 'Yes' : 'No' }}</span></div>
                <div class="ve-item"><span class="ve-label">Oldpeak</span><span class="ve-val">{{ v.oldpeak }}</span></div>
                <div class="ve-item"><span class="ve-label">Slope</span><span class="ve-val">{{ v.slope }}</span></div>
                <div class="ve-item"><span class="ve-label">CA (Major Vessels)</span><span class="ve-val">{{ v.ca }}</span></div>
              </div>
              @if (v.riskLevel) {
                <div class="ve-risk" [style.color]="riskColor(v.riskLevel)">
                  <i class="pi pi-circle-fill" style="font-size:8px"></i>
                  Score: {{ v.riskScore }}/100 — {{ riskLabel(v.riskLevel) }}
                </div>
              }
            </div>
          }
        </div>
      </p-tabpanel>

      <!-- ── Notes ── -->
      <p-tabpanel value="2" header="Notes médicales">
        @if (file()!.notes.length === 0) {
          <div class="mf-empty-tab">
            <i class="pi pi-file"></i>
            <p>Aucune note enregistrée.</p>
          </div>
        }
        <div class="notes-list">
          @for (note of file()!.notes; track note.id) {
            <div class="note-entry">
              <div class="note-entry-header">
                <span class="note-entry-author">{{ note.authorName }}</span>
                <span class="note-entry-date">{{ note.createdAt | date:'dd/MM/yyyy à HH:mm' }}</span>
              </div>
              <p class="note-entry-content">{{ note.content }}</p>
            </div>
          }
        </div>
      </p-tabpanel>

    </p-tabs>
  }
</div>
  `,
  styles: [`
    .medical-file-content { padding: 20px; overflow-y: auto; flex: 1; font-family: 'DM Sans', sans-serif; }
    .mf-loading { padding: 20px; }

    .mf-empty, .mf-empty-tab {
      display: flex; flex-direction: column; align-items: center;
      padding: 60px; color: #d1d5db;
      .pi { font-size: 48px; margin-bottom: 12px; }
      p   { margin: 0; }
    }

    /* Patient banner */
    .patient-banner {
      display: flex; align-items: center; gap: 16px;
      background: linear-gradient(135deg, #022c22 0%, #064e3b 100%);
      border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; color: white;
    }

    .patient-avatar-lg {
      width: 56px; height: 56px; border-radius: 50%;
      background: rgba(52,211,153,0.2); color: #34d399;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Sora', sans-serif; font-weight: 700; font-size: 20px;
      border: 2px solid rgba(52,211,153,0.4);
    }

    .patient-banner-info h2 {
      margin: 0; font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700;
    }

    .banner-meta { display: flex; gap: 8px; margin-top: 4px; font-size: 13px; opacity: 0.7; }
    .meta-sep { opacity: 0.4; }

    /* Tabs */
    ::ng-deep .mf-tabs .p-tabs-nav { border-color: #e5e7eb; }

    /* Consultations timeline */
    ::ng-deep .mf-timeline .p-timeline-event-connector { background: #e5e7eb; }

    .timeline-marker {
      width: 32px; height: 32px; border-radius: 50%;
      background: #d1fae5; color: #059669;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px;
    }

    .consultation-entry {
      background: var(--card-bg, #fff);
      border: 1px solid var(--card-border, #e5e7eb);
      border-radius: 10px; padding: 14px 16px; margin-bottom: 12px;
    }

    .entry-header { display: flex; gap: 12px; align-items: center; margin-bottom: 10px; }
    .entry-date   { font-weight: 700; color: #059669; font-size: 13px; }
    .entry-doctor { font-size: 13px; color: #6b7280; }

    .entry-section { margin-bottom: 8px; }
    .entry-label   { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; font-weight: 700; display: block; margin-bottom: 3px; }
    .entry-text    { margin: 0; font-size: 14px; color: var(--text-primary, #111827); line-height: 1.5; }

    /* Vitals history */
    .vitals-history { display: flex; flex-direction: column; gap: 10px; padding: 8px 0; }

    .vitals-entry {
      border: 1px solid var(--card-border, #e5e7eb);
      border-left: 4px solid #e5e7eb;
      border-radius: 10px; padding: 12px 16px;
      background: var(--card-bg, #fff);
      &.risk-border-low      { border-left-color: #059669; }
      &.risk-border-moderate { border-left-color: #d97706; }
      &.risk-border-high     { border-left-color: #ef4444; }
      &.risk-border-critical { border-left-color: #7f1d1d; }
    }

    .ve-date { font-size: 12px; color: #9ca3af; margin-bottom: 8px; }
    .ve-grid { display: flex; gap: 20px; flex-wrap: wrap; }
    .ve-item { display: flex; flex-direction: column; gap: 2px; }
    .ve-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; }
    .ve-val   { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 15px; color: var(--text-primary, #111827); }
    .ve-risk  { margin-top: 8px; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 5px; }

    /* Notes */
    .notes-list { display: flex; flex-direction: column; gap: 12px; padding: 8px 0; }

    .note-entry {
      border: 1px solid var(--card-border, #e5e7eb);
      border-radius: 10px; padding: 14px 16px;
      background: var(--card-bg, #fff);
    }

    .note-entry-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .note-entry-author { font-weight: 600; font-size: 13px; color: var(--text-primary, #111827); }
    .note-entry-date   { font-size: 12px; color: #9ca3af; }
    .note-entry-content { margin: 0; font-size: 14px; color: #4b5563; line-height: 1.7; }
  `]
})
export class MedicalFileComponent implements OnInit, OnChanges {
  @Input({ required: true }) patientId!: string;

  private api   = inject(DoctorApiService);
  private state = inject(DoctorStateService);

  file    = signal<MedicalFileResponse | null>(null);
  loading = signal(true);

  ngOnInit()              { this.load(); }
  ngOnChanges(c: SimpleChanges) { if (c['patientId']) this.load(); }

  load() {
    this.loading.set(true);
    this.api.getMedicalFile(this.patientId).subscribe({
      next: f  => { this.file.set(f); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  patientInitials(): string {
    const f = this.file();
    if (!f) return '?';
    return `${f.patientFirstName?.[0] ?? ''}${f.patientLastName?.[0] ?? ''}`.toUpperCase();
  }

  riskColor(level: RiskLevel): string  { return RISK_COLORS[level] ?? '#6b7280'; }
  riskLabel(level: RiskLevel): string  {
    const m: Record<RiskLevel, string> = {
      LOW: 'Faible', MODERATE: 'Modéré', HIGH: 'Élevé', CRITICAL: 'Critique'
    };
    return m[level];
  }
}