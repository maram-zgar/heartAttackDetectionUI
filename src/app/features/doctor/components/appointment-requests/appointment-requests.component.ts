import {
  Component, OnInit, inject, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { DoctorStateService } from '../../services/doctor-state.service';
import { DoctorApiService } from '../../services/doctor-api.service';
import { AppointmentResponse } from '../../models/doctor.model';

@Component({
  selector: 'app-appointment-requests',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    ButtonModule, TagModule, DialogModule, DatePickerModule,
    SelectModule, InputTextModule, TextareaModule,
    TableModule, TabsModule, TooltipModule
  ],
  template: `
<div class="appt-wrap">

  <!-- Tabs: Requests / Upcoming / All -->
  <p-tabs [(value)]="activeTab" styleClass="cs-tabs">

    <!-- ── PENDING REQUESTS ── -->
    <p-tabpanel value="0">
      <ng-template pTemplate="header">
        <span class="tab-label">
          Demandes
          @if (state.pendingRequestsCount() > 0) {
            <span class="tab-badge">{{ state.pendingRequestsCount() }}</span>
          }
        </span>
      </ng-template>

      @if (state.pendingAppointments().length === 0) {
        <div class="empty-state">
          <i class="pi pi-check-circle"></i>
          <p>Aucune demande en attente</p>
        </div>
      }

      @for (appt of state.pendingAppointments(); track appt.id) {
        <div class="request-card">
          <div class="request-left">
            <div class="requester-avatar">
              {{ appt.patientFirstName[0] }}{{ appt.patientLastName[0] }}
            </div>
            <div class="request-info">
              <span class="request-name">{{ appt.patientFirstName }} {{ appt.patientLastName }}</span>
              <span class="request-date">
                <i class="pi pi-calendar"></i>
                {{ appt.scheduledAt | date:'dd/MM/yyyy à HH:mm' }}
                — {{ appt.duration }} min
              </span>
            </div>
          </div>
          <div class="request-actions">
            <p-button
              label="Accepter"
              icon="pi pi-check"
              severity="success"
              size="small"
              [loading]="actionLoading() === appt.id + '_accept'"
              (onClick)="accept(appt)"
            />
            <p-button
              label="Reprogrammer"
              icon="pi pi-calendar"
              severity="info"
              size="small"
              [outlined]="true"
              (onClick)="openReschedule(appt)"
            />
            <p-button
              label="Refuser"
              icon="pi pi-times"
              severity="danger"
              size="small"
              [outlined]="true"
              [loading]="actionLoading() === appt.id + '_cancel'"
              (onClick)="deny(appt)"
            />
          </div>
        </div>
      }
    </p-tabpanel>

    <!-- ── UPCOMING CONFIRMED ── -->
    <p-tabpanel value="1" header="À venir">
      <p-table
        [value]="state.upcomingAppointments()"
        styleClass="cs-table"
        [rowHover]="true"
      >
        <ng-template pTemplate="header">
          <tr>
            <th>Patient</th>
            <th>Date & heure</th>
            <th>Durée</th>
            <th>Motif</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-appt>
          <tr>
            <td class="fw-600">{{ appt.patientFirstName }} {{ appt.patientLastName }}</td>
            <td>{{ appt.scheduledAt | date:'dd/MM/yyyy HH:mm' }}</td>
            <td>{{ appt.duration }} min</td>
            <td class="text-muted">{{ appt.reason || '—' }}</td>
            <td>
              <p-tag [value]="statusLabel(appt.status)" [severity]="statusSeverity(appt.status)" />
            </td>
            <td>
              <div class="row-actions">
                <p-button icon="pi pi-calendar" [rounded]="true" [text]="true"
                  severity="info" pTooltip="Reprogrammer" (onClick)="openReschedule(appt)" />
                <p-button icon="pi pi-times" [rounded]="true" [text]="true"
                  severity="danger" pTooltip="Annuler" (onClick)="deny(appt)" />
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="6">
            <div class="empty-state"><i class="pi pi-calendar"></i><p>Aucun rendez-vous à venir</p></div>
          </td></tr>
        </ng-template>
      </p-table>
    </p-tabpanel>

    <!-- ── ALL ── -->
    <p-tabpanel value="2" header="Tous">
      <p-table
        [value]="state.appointments()"
        [paginator]="true"
        [rows]="8"
        styleClass="cs-table"
        [rowHover]="true"
      >
        <ng-template pTemplate="header">
          <tr>
            <th>Patient</th>
            <th>Date</th>
            <th>Statut</th>
            <th>Motif</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-appt>
          <tr>
            <td class="fw-600">{{ appt.patientFirstName }} {{ appt.patientLastName }}</td>
            <td>{{ appt.scheduledAt | date:'dd/MM/yyyy HH:mm' }}</td>
            <td><p-tag [value]="statusLabel(appt.status)" [severity]="statusSeverity(appt.status)" /></td>
            <td class="text-muted">{{ appt.reason || '—' }}</td>
          </tr>
        </ng-template>
      </p-table>
    </p-tabpanel>
  </p-tabs>

  <!-- New Appointment FAB -->
  <p-button
    icon="pi pi-plus"
    label="Nouveau rendez-vous"
    styleClass="new-appt-btn"
    (onClick)="showNewAppt = true"
  />
</div>

<!-- ── Reschedule dialog ── -->
<p-dialog
  [(visible)]="showReschedule"
  [modal]="true"
  header="Reprogrammer le rendez-vous"
  styleClass="cs-dialog"
  [style]="{ width: '440px' }"
  (onHide)="rescheduleForm.reset()"
>
  <form [formGroup]="rescheduleForm" (ngSubmit)="submitReschedule()" class="reschedule-form">
    <div class="field">
      <label>Nouvelle date & heure <span class="req">*</span></label>
      <p-datepicker
        formControlName="scheduledAt"
        [showTime]="true"
        [showIcon]="true"
        dateFormat="dd/mm/yy"
        placeholder="Sélectionner une date"
        styleClass="w-full"
        [minDate]="today"
      />
    </div>
    <div class="field">
      <label>Durée (minutes)</label>
      <p-select
        formControlName="duration"
        [options]="durationOptions"
        styleClass="w-full"
      />
    </div>
    <div class="field">
      <label>Notes</label>
      <textarea pTextarea formControlName="notes" rows="3" placeholder="Notes optionnelles…" class="w-full"></textarea>
    </div>
    <div class="dialog-actions">
      <p-button label="Annuler" severity="secondary" [outlined]="true" (onClick)="showReschedule = false" />
      <p-button label="Reprogrammer" icon="pi pi-check" type="submit"
        [loading]="rescheduling()" [disabled]="rescheduleForm.invalid" />
    </div>
  </form>
</p-dialog>

<!-- ── New Appointment dialog ── -->
<p-dialog
  [(visible)]="showNewAppt"
  [modal]="true"
  header="Nouveau rendez-vous"
  styleClass="cs-dialog"
  [style]="{ width: '480px' }"
>
  <form [formGroup]="newApptForm" (ngSubmit)="submitNewAppt()" class="reschedule-form">
    <div class="field">
      <label>Patient <span class="req">*</span></label>
      <p-select
        formControlName="patientId"
        [options]="patientOptions()"
        optionLabel="label"
        optionValue="value"
        placeholder="Sélectionner un patient"
        styleClass="w-full"
        [filter]="true"
      />
    </div>
    <div class="field">
      <label>Date & heure <span class="req">*</span></label>
      <p-datepicker
        formControlName="scheduledAt"
        [showTime]="true"
        [showIcon]="true"
        dateFormat="dd/mm/yy"
        styleClass="w-full"
        [minDate]="today"
      />
    </div>
    <div class="field">
      <label>Durée (minutes)</label>
      <p-select formControlName="duration" [options]="durationOptions" styleClass="w-full" />
    </div>
    <div class="field">
      <label>Motif</label>
      <input pInputText formControlName="reason" placeholder="Motif de la consultation" />
    </div>
    <div class="dialog-actions">
      <p-button label="Annuler" severity="secondary" [outlined]="true" (onClick)="showNewAppt = false" />
      <p-button label="Créer" icon="pi pi-check" type="submit"
        [loading]="creatingAppt()" [disabled]="newApptForm.invalid" />
    </div>
  </form>
</p-dialog>
  `,
  styles: [`
    .appt-wrap { position: relative; }

    ::ng-deep .cs-tabs .p-tabs-nav { border-color: var(--card-border, #e5e7eb); }

    .tab-label { display: flex; align-items: center; gap: 6px; font-family: 'DM Sans', sans-serif; }
    .tab-badge {
      background: #ef4444; color: white; border-radius: 10px;
      font-size: 10px; font-weight: 700; padding: 1px 6px; min-width: 18px; text-align: center;
    }

    .request-card {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border: 1px solid var(--card-border, #e5e7eb);
      border-radius: 10px; margin-bottom: 10px; background: var(--card-bg, #fff);
      transition: box-shadow 0.2s;
      &:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
    }

    .request-left { display: flex; align-items: center; gap: 14px; }

    .requester-avatar {
      width: 44px; height: 44px; border-radius: 50%;
      background: #022c22; color: #34d399;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Sora', sans-serif; font-weight: 700; font-size: 14px;
    }

    .request-info { display: flex; flex-direction: column; gap: 3px; }
    .request-name { font-weight: 700; font-size: 15px; color: var(--text-primary, #111827); }
    .request-date { font-size: 13px; color: #6b7280; display: flex; align-items: center; gap: 5px; }
    .request-reason { font-size: 12px; color: #9ca3af; font-style: italic; }

    .request-actions { display: flex; gap: 8px; flex-wrap: wrap; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 60px; color: #d1d5db;
      .pi { font-size: 48px; margin-bottom: 12px; }
      p   { margin: 0; font-family: 'DM Sans', sans-serif; }
    }

    ::ng-deep .cs-table .p-datatable-thead > tr > th {
      background: #f9fafb; font-size: 12px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;
      font-family: 'DM Sans', sans-serif;
    }
    ::ng-deep .cs-table .p-datatable-tbody > tr > td {
      font-family: 'DM Sans', sans-serif; font-size: 14px;
    }

    .fw-600  { font-weight: 600; }
    .text-muted { color: #6b7280; }
    .row-actions { display: flex; gap: 4px; }

    .new-appt-btn {
      position: fixed; bottom: 32px; right: 32px;
      box-shadow: 0 8px 24px rgba(5,150,105,0.35);
      z-index: 50;
    }

    .reschedule-form { display: flex; flex-direction: column; gap: 4px; padding: 8px 0; }
    .field {
      display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px;
      label { font-size: 13px; font-weight: 600; color: #374151; font-family: 'DM Sans', sans-serif; }
    }
    .req { color: #ef4444; }
    .w-full { width: 100%; }
    .dialog-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }
  `]
})
export class AppointmentRequestsComponent implements OnInit {
  state = inject(DoctorStateService);
  private api  = inject(DoctorApiService);
  private fb   = inject(FormBuilder);

  activeTab = '0';
  showReschedule = false;
  showNewAppt    = false;
  today = new Date();

  actionLoading  = signal<string | null>(null);
  rescheduling   = signal(false);
  creatingAppt   = signal(false);

  selectedAppt = signal<AppointmentResponse | null>(null);

  patientOptions = computed(() =>
    this.state.patients().map(p => ({
      label: `${p.firstName} ${p.lastName}`,
      value: p.id
    }))
  );

  durationOptions = [15, 20, 30, 45, 60, 90].map(v => ({ label: `${v} min`, value: v }));

  rescheduleForm = this.fb.group({
    scheduledAt: [null as Date | null, Validators.required],
    duration:    [30, Validators.required],
    notes:       [''],
  });

  newApptForm = this.fb.group({
    patientId:   ['', Validators.required],
    scheduledAt: [null as Date | null, Validators.required],
    duration:    [30, Validators.required],
    reason:      [''],
  });

  ngOnInit() {
    if (!this.state.appointments().length) this.state.reloadAppointments();
    if (!this.state.patients().length) this.state.reloadPatients();
  }

  accept(appt: AppointmentResponse) {
    this.actionLoading.set(appt.id + '_accept');
    this.api.confirmAppointment(appt.id, {
      patientId:   appt.patientId,
      doctorId:    appt.doctorId,
      scheduledAt: appt.scheduledAt,
      duration:    appt.duration,
    }).subscribe({
      next: () => {
        this.state.updateAppointmentStatus(appt.id, 'CONFIRMED');
        this.actionLoading.set(null);
      },
      error: () => this.actionLoading.set(null)
    });
  }

  deny(appt: AppointmentResponse) {
    if (!confirm(`Annuler le rendez-vous de ${appt.patientFirstName} ${appt.patientLastName} ?`)) return;
    this.actionLoading.set(appt.id + '_cancel');
    this.api.cancelAppointment(appt.id).subscribe({
      next: () => {
        this.state.updateAppointmentStatus(appt.id, 'CANCELLED');
        this.actionLoading.set(null);
      },
      error: () => this.actionLoading.set(null)
    });
  }

  openReschedule(appt: AppointmentResponse) {
    this.selectedAppt.set(appt);
    this.rescheduleForm.reset({ duration: appt.duration });
    this.showReschedule = true;
  }

  submitReschedule() {
    if (this.rescheduleForm.invalid || !this.selectedAppt()) return;
    this.rescheduling.set(true);
    const appt = this.selectedAppt()!;
    const raw  = this.rescheduleForm.value;

    this.api.rescheduleAppointment(appt.id, {
      patientId:   appt.patientId,
      doctorId:    appt.doctorId,
      scheduledAt: (raw.scheduledAt as Date).toISOString(),
      duration:    raw.duration!,
    }).subscribe({
      next: () => {
        this.state.reloadAppointments();
        this.rescheduling.set(false);
        this.showReschedule = false;
      },
      error: () => this.rescheduling.set(false)
    });
  }

  submitNewAppt() {
    if (this.newApptForm.invalid) return;
    this.creatingAppt.set(true);
    const raw = this.newApptForm.value;
    const doctorId = this.state.doctorProfile()?.id.toString()!;

    this.api.createAppointment({
      patientId:   raw.patientId!,
      doctorId,
      scheduledAt: (raw.scheduledAt as Date).toISOString(),
      duration:    raw.duration!,
    }).subscribe({
      next: () => {
        this.state.reloadAppointments();
        this.creatingAppt.set(false);
        this.showNewAppt = false;
        this.newApptForm.reset({ duration: 30 });
      },
      error: () => this.creatingAppt.set(false)
    });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'En attente', ACCEPTED: 'Confirmé',
      CANCELLED: 'Annulé', RESCHEDULED: 'Reprogrammé', COMPLETED: 'Terminé'
    };
    return map[status] ?? status;
  }

  statusSeverity(status: string): "success" | "info" | "warn" | "danger" | "secondary" | "contrast" {
    const map: Record<string, "success" | "info" | "warn" | "danger" | "secondary" | "contrast"> = {
    PENDING: 'warn', 
    ACCEPTED: 'success',
    CANCELLED: 'danger', 
    RESCHEDULED: 'info', 
    COMPLETED: 'secondary'
  };
    return map[status] ?? 'info';
  }
}