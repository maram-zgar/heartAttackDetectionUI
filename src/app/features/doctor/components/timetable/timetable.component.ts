import {
  Component, Input, OnInit, inject, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { FormsModule } from '@angular/forms';
import { DoctorStateService } from '../../services/doctor-state.service';
import { AppointmentResponse } from '../../models/doctor.model';

type CalendarMode = 'day' | 'week' | 'month';

const STATUS_LABELS: Record<string, string> = {
  PENDING:     'En attente',
  ACCEPTED:    'Confirmé',
  CANCELLED:   'Annulé',
  RESCHEDULED: 'Reprogrammé',
  COMPLETED:   'Terminé',
};

type TagSeverity = "success" | "info" | "warn" | "danger" | "secondary" | "contrast" | null | undefined;

const STATUS_SEVERITY: Record<string, TagSeverity> = {
  PENDING:     'warn',
  ACCEPTED:    'success',
  CANCELLED:   'danger',
  RESCHEDULED: 'info',
  COMPLETED:   'secondary',
};

@Component({
  selector: 'app-timetable',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, SelectButtonModule,
    TagModule, TooltipModule, SkeletonModule
  ],
  template: `
<div class="timetable-wrap" [class.preview]="previewMode">

  @if (!previewMode) {
    <!-- Controls -->
    <div class="timetable-controls">
      <div class="nav-controls">
        <p-button icon="pi pi-chevron-left" [text]="true" [rounded]="true" (onClick)="prev()" />
        <span class="period-label">{{ periodLabel() }}</span>
        <p-button icon="pi pi-chevron-right" [text]="true" [rounded]="true" (onClick)="next()" />
        <p-button label="Aujourd'hui" severity="secondary" [outlined]="true" size="small" (onClick)="goToday()" />
      </div>
      <p-selectbutton
        [(ngModel)]="mode"
        [options]="modeOptions"
        optionLabel="label"
        optionValue="value"
        styleClass="mode-selector"
      />
    </div>
  }

  <!-- DAY VIEW -->
  @if (mode === 'day' || previewMode) {
    <div class="day-view">
      @if (previewMode) {
        <p class="day-view-date">{{ today | date:'EEEE d MMMM yyyy':'':'fr' }}</p>
      }
      @if (dayAppointments().length === 0) {
        <div class="no-appts">
          <i class="pi pi-calendar"></i>
          <p>Aucun rendez-vous {{ previewMode ? "aujourd'hui" : 'ce jour' }}</p>
        </div>
      }
      @for (appt of dayAppointments(); track appt.id) {
        <div class="appt-card" [class]="'status-' + appt.status.toLowerCase()">
          <div class="appt-time">
            <span class="time-start">{{ appt.scheduledAt | date:'HH:mm' }}</span>
            <span class="time-dur">{{ appt.duration }} min</span>
          </div>
          <div class="appt-info">
            <span class="appt-patient">
              {{ appt.patientFirstName }} {{ appt.patientLastName }}
            </span>
          </div>
          <p-tag
            [value]="statusLabel(appt.status)"
            [severity]="statusSeverity(appt.status)"
            styleClass="appt-tag"
          />
        </div>
      }
    </div>
  }

  <!-- WEEK VIEW -->
  @if (mode === 'week' && !previewMode) {
    <div class="week-grid">
      @for (day of weekDays(); track day.date) {
        <div class="week-col" [class.today]="isToday(day.date)">
          <div class="week-col-header">
            <span class="day-name">{{ day.date | date:'EEE':'':'fr' }}</span>
            <span class="day-num" [class.today-num]="isToday(day.date)">
              {{ day.date | date:'d' }}
            </span>
          </div>
          <div class="week-col-body">
            @for (appt of day.appointments; track appt.id) {
              <div class="week-appt-pill" [class]="'status-' + appt.status.toLowerCase()"
                   [pTooltip]="appt.patientFirstName + ' ' + appt.patientLastName + ' — ' + (appt.scheduledAt | date:'HH:mm')"
                   tooltipPosition="top">
                <span class="pill-time">{{ appt.scheduledAt | date:'HH:mm' }}</span>
                <span class="pill-name">{{ appt.patientFirstName }} {{ appt.patientLastName }}</span>
              </div>
            }
            @if (day.appointments.length === 0) {
              <div class="no-appts-mini">Libre</div>
            }
          </div>
        </div>
      }
    </div>
  }

  <!-- MONTH VIEW -->
  @if (mode === 'month' && !previewMode) {
    <div class="month-grid">
      @for (header of ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']; track header) {
        <div class="month-header-cell">{{ header }}</div>
      }
      @for (cell of monthCells(); track cell.key) {
        <div class="month-cell" [class.today]="cell.isToday" [class.other-month]="!cell.inMonth">
          <span class="month-day-num">{{ cell.date.getDate() }}</span>
          @for (appt of cell.appointments.slice(0, 3); track appt.id) {
            <div class="month-appt-dot" [class]="'status-' + appt.status.toLowerCase()"
                 [pTooltip]="appt.patientFirstName + ' ' + appt.patientLastName"
                 tooltipPosition="top">
              {{ appt.scheduledAt | date:'HH:mm' }} {{ appt.patientLastName }}
            </div>
          }
          @if (cell.appointments.length > 3) {
            <span class="month-more">+{{ cell.appointments.length - 3 }}</span>
          }
        </div>
      }
    </div>
  }
</div>
  `,
  styles: [`
    .timetable-wrap { font-family: 'DM Sans', sans-serif; }
    .timetable-wrap:not(.preview) {
      background: var(--card-bg, #fff);
      border: 1px solid var(--card-border, #e5e7eb);
      border-radius: 12px; overflow: hidden;
    }

    .timetable-controls {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px; border-bottom: 1px solid var(--card-border, #e5e7eb);
    }

    .nav-controls { display: flex; align-items: center; gap: 8px; }

    .period-label {
      font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 600;
      color: var(--text-primary, #111827); min-width: 180px; text-align: center;
    }

    ::ng-deep .mode-selector .p-selectbutton .p-button {
      font-size: 13px; padding: 6px 14px; font-family: 'DM Sans', sans-serif;
    }

    /* ── Day view ── */
    .day-view { padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }
    .day-view-date {
      font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 600;
      color: #6b7280; margin: 0 0 8px; text-transform: capitalize;
    }

    .appt-card {
      display: flex; align-items: center; gap: 16px;
      padding: 12px 16px; border-radius: 10px;
      border-left: 4px solid #e5e7eb;
      background: #f9fafb; transition: transform 0.15s;
      &:hover { transform: translateX(3px); }
      &.status-accepted   { border-left-color: #059669; background: #f0fdf4; }
      &.status-pending    { border-left-color: #d97706; background: #fffbeb; }
      &.status-cancelled  { border-left-color: #ef4444; background: #fef2f2; }
      &.status-completed  { border-left-color: #6b7280; background: #f9fafb; opacity: 0.7; }
      &.status-rescheduled{ border-left-color: #3b82f6; background: #eff6ff; }
    }

    .appt-time { display: flex; flex-direction: column; min-width: 52px; }
    .time-start { font-weight: 700; font-size: 15px; color: #111827; }
    .time-dur   { font-size: 11px; color: #9ca3af; }

    .appt-info { flex: 1; display: flex; flex-direction: column; }
    .appt-patient { font-weight: 600; font-size: 14px; color: #111827; }
    .appt-reason  { font-size: 12px; color: #6b7280; margin-top: 2px; }

    .no-appts {
      display: flex; flex-direction: column; align-items: center;
      padding: 40px; color: #d1d5db;
      .pi { font-size: 40px; margin-bottom: 10px; }
      p   { margin: 0; font-size: 14px; }
    }

    /* ── Week view ── */
    .week-grid {
      display: grid; grid-template-columns: repeat(7, 1fr);
      border-top: 1px solid var(--card-border, #e5e7eb);
    }

    .week-col {
      border-right: 1px solid var(--card-border, #e5e7eb);
      &:last-child { border-right: none; }
      &.today .week-col-header { background: #f0fdf4; }
    }

    .week-col-header {
      display: flex; flex-direction: column; align-items: center;
      padding: 10px 4px; border-bottom: 1px solid var(--card-border, #e5e7eb);
      background: #f9fafb;
    }

    .day-name { font-size: 11px; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.5px; }
    .day-num  { font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700; color: #374151; }
    .today-num {
      background: #059669; color: white; border-radius: 50%;
      width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
    }

    .week-col-body { padding: 8px 6px; min-height: 180px; display: flex; flex-direction: column; gap: 4px; }

    .week-appt-pill {
      border-radius: 6px; padding: 4px 6px; cursor: default;
      font-size: 11px; border-left: 3px solid;
      &.status-accepted    { background: #d1fae5; border-color: #059669; }
      &.status-pending     { background: #fef3c7; border-color: #d97706; }
      &.status-cancelled   { background: #fee2e2; border-color: #ef4444; text-decoration: line-through; }
      &.status-completed   { background: #f3f4f6; border-color: #9ca3af; }
      &.status-rescheduled { background: #dbeafe; border-color: #3b82f6; }
    }

    .pill-time { display: block; font-weight: 700; color: #374151; }
    .pill-name { display: block; color: #4b5563; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .no-appts-mini { font-size: 11px; color: #d1d5db; text-align: center; margin-top: 20px; }

    /* ── Month view ── */
    .month-grid {
      display: grid; grid-template-columns: repeat(7, 1fr);
      border-top: 1px solid var(--card-border, #e5e7eb);
    }

    .month-header-cell {
      padding: 8px; text-align: center;
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
      color: #9ca3af; background: #f9fafb;
      border-right: 1px solid var(--card-border, #e5e7eb);
      border-bottom: 1px solid var(--card-border, #e5e7eb);
      &:last-child { border-right: none; }
    }

    .month-cell {
      min-height: 90px; padding: 6px 8px;
      border-right: 1px solid var(--card-border, #e5e7eb);
      border-bottom: 1px solid var(--card-border, #e5e7eb);
      &:nth-child(7n) { border-right: none; }
      &.today { background: #f0fdf4; }
      &.other-month { background: #fafafa; opacity: 0.5; }
    }

    .month-day-num {
      font-size: 13px; font-weight: 600; color: #374151; display: block; margin-bottom: 4px;
      .today & {
        background: #059669; color: white; border-radius: 50%;
        width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
      }
    }

    .month-appt-dot {
      font-size: 10px; padding: 2px 4px; border-radius: 4px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      margin-bottom: 2px;
      &.status-accepted    { background: #d1fae5; color: #065f46; }
      &.status-pending     { background: #fef3c7; color: #92400e; }
      &.status-cancelled   { background: #fee2e2; color: #991b1b; }
      &.status-completed   { background: #f3f4f6; color: #4b5563; }
      &.status-rescheduled { background: #dbeafe; color: #1e40af; }
    }

    .month-more { font-size: 10px; color: #9ca3af; }
  `]
})
export class TimetableComponent implements OnInit {
  @Input() previewMode = false;

  private state = inject(DoctorStateService);

  mode: CalendarMode = 'day';
  today = new Date();
  currentDate = signal(new Date());

  modeOptions = [
    { label: 'Jour',     value: 'day'   },
    { label: 'Semaine',  value: 'week'  },
    { label: 'Mois',     value: 'month' },
  ];

  ngOnInit() {
    if (!this.state.appointments().length) {
      this.state.reloadAppointments();
    }
  }

  // ── Computed views ──────────────────────────────────────────────────────────
  dayAppointments = computed(() => {
    const d = this.currentDate().toISOString().slice(0, 10);
    return this.state.appointments()
      .filter(a => a.scheduledAt.startsWith(d))
      .filter(a => a.status !== 'CANCELLED')
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  });

  periodLabel = computed(() => {
    const d = this.currentDate();
    if (this.mode === 'day') return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (this.mode === 'week') {
      const start = this.weekStart(d);
      const end   = new Date(start); end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  });

  weekDays = computed(() => {
    const start = this.weekStart(this.currentDate());
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const ds = date.toISOString().slice(0, 10);
      return {
        date,
        appointments: this.state.appointments().filter(a =>
          a.scheduledAt.startsWith(ds) && a.status !== 'CANCELLED'
        ).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      };
    });
  });

  monthCells = computed(() => {
    const d = this.currentDate();
    const year = d.getFullYear(), month = d.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const todayStr = new Date().toISOString().slice(0, 10);

    // start from Monday of the week containing firstDay
    const start = new Date(firstDay);
    const dow = (start.getDay() + 6) % 7; // Monday=0
    start.setDate(start.getDate() - dow);

    const cells = [];
    const cursor = new Date(start);

    while (cursor <= lastDay || cells.length % 7 !== 0 || cells.length < 35) {
      const ds = cursor.toISOString().slice(0, 10);
      cells.push({
        key: ds,
        date: new Date(cursor),
        inMonth: cursor.getMonth() === month,
        isToday: ds === todayStr,
        appointments: this.state.appointments().filter(a => a.scheduledAt.startsWith(ds))
      });
      cursor.setDate(cursor.getDate() + 1);
      if (cells.length >= 42) break;
    }
    return cells;
  });

  // ── Navigation ──────────────────────────────────────────────────────────────
  prev() {
    const d = new Date(this.currentDate());
    if (this.mode === 'day')   d.setDate(d.getDate() - 1);
    if (this.mode === 'week')  d.setDate(d.getDate() - 7);
    if (this.mode === 'month') d.setMonth(d.getMonth() - 1);
    this.currentDate.set(d);
  }

  next() {
    const d = new Date(this.currentDate());
    if (this.mode === 'day')   d.setDate(d.getDate() + 1);
    if (this.mode === 'week')  d.setDate(d.getDate() + 7);
    if (this.mode === 'month') d.setMonth(d.getMonth() + 1);
    this.currentDate.set(d);
  }

  goToday() { this.currentDate.set(new Date()); }

  isToday(date: Date): boolean {
    return date.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
  }

  weekStart(d: Date): Date {
    const s = new Date(d);
    const dow = (s.getDay() + 6) % 7;
    s.setDate(s.getDate() - dow);
    return s;
  }

  statusSeverity(status: string): TagSeverity { return STATUS_SEVERITY[status] ?? 'info'; }
  statusLabel(status: string): string    { return STATUS_LABELS[status] ?? status; }
}