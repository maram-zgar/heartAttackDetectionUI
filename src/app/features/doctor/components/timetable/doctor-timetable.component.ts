import {
  Component, OnInit, OnDestroy, inject, signal, computed, Input
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { ButtonModule }      from 'primeng/button';
import { CheckboxModule }    from 'primeng/checkbox';
import { DialogModule }      from 'primeng/dialog';
import { SelectModule }      from 'primeng/select';
import { TooltipModule }     from 'primeng/tooltip';
import { ToastModule }       from 'primeng/toast';
import { TagModule }         from 'primeng/tag';
import { MessageService }    from 'primeng/api';
import { Skeleton }          from 'primeng/skeleton';

import {
  AvailabilityTimetableService,
  DoctorAvailabilityResponse,
  TimetableDay,
  TimetableSlot,
  TimetableRange,
  DayOfWeek,
  AppointmentRequest,
} from '../../../../core/http/availability-timetable.service';

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

interface DayConfig {
  dow: DayOfWeek;
  label: string;
  selected: boolean;
  startTime: string;
  endTime: string;
}

interface SelectOption<T> { label: string; value: T; }

const RANGE_OPTIONS: SelectOption<TimetableRange>[] = [
  { label: 'Semaine', value: '1week'   },
  { label: 'Mois',    value: '1month'  },
  { label: '3 mois',  value: '3months' },
];

// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-doctor-timetable',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, CheckboxModule, DialogModule, SelectModule,
    TooltipModule, ToastModule, TagModule, Skeleton,
  ],
  providers: [MessageService],
  templateUrl: './doctor-timetable.component.html',
  styleUrls:   ['./doctor-timetable.component.scss'],
})
export class DoctorTimetableComponent implements OnInit, OnDestroy {

  @Input() doctorId!: string;
  @Input() appointments: any[] = [];

  private readonly svc     = inject(AvailabilityTimetableService);
  private readonly msg     = inject(MessageService);
  private readonly destroy$ = new Subject<void>();

  readonly rangeOptions = RANGE_OPTIONS;

  // ── Loading ────────────────────────────────────────────────────────────────
  readonly loadingAvailability = signal(false);
  readonly loadingTimetable    = signal(false);
  readonly savingSchedule      = signal(false);

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly availability  = signal<DoctorAvailabilityResponse[]>([]);
  readonly timetable     = signal<TimetableDay[]>([]);
  readonly selectedRange = signal<TimetableRange>('1week');
  readonly windowStart   = signal(new Date());
  readonly selectedSlot  = signal<TimetableSlot | null>(null);

  // ── UI ─────────────────────────────────────────────────────────────────────
  scheduleDialogVisible = false;
  slotDialogVisible     = false;

  // ── Day configuration ──────────────────────────────────────────────────────
  readonly dayConfigs: DayConfig[] = [
    { dow: 'MONDAY',    label: 'Lundi',    selected: false, startTime: '08:00', endTime: '17:00' },
    { dow: 'TUESDAY',   label: 'Mardi',    selected: false, startTime: '08:00', endTime: '17:00' },
    { dow: 'WEDNESDAY', label: 'Mercredi', selected: false, startTime: '08:00', endTime: '17:00' },
    { dow: 'THURSDAY',  label: 'Jeudi',    selected: false, startTime: '08:00', endTime: '17:00' },
    { dow: 'FRIDAY',    label: 'Vendredi', selected: false, startTime: '08:00', endTime: '17:00' },
    { dow: 'SATURDAY',  label: 'Samedi',   selected: false, startTime: '09:00', endTime: '13:00' },
    { dow: 'SUNDAY',    label: 'Dimanche', selected: false, startTime: '09:00', endTime: '13:00' },
  ];

  // ── Computed ───────────────────────────────────────────────────────────────

  /** All distinct HH:mm times across all work days — used for grid rows */
  readonly timeRows = computed<string[]>(() => {
    const set = new Set<string>();
    this.timetable().forEach(day => {
      if (day.isWorkDay) day.slots.forEach(s => set.add(s.time));
    });
    return [...set].sort();
  });

  /** Group timetable days by ISO week number */
  readonly weekGroups = computed(() => {
    const groups: { weekLabel: string; days: TimetableDay[] }[] = [];
    let currentWeek = -1;
    let currentGroup: TimetableDay[] = [];

    this.timetable().forEach(day => {
      const wk = this.svc.getWeekNumber(new Date(day.date));
      if (wk !== currentWeek) {
        if (currentGroup.length) groups.push({ weekLabel: this.buildWeekLabel(currentGroup), days: currentGroup });
        currentGroup = [];
        currentWeek = wk;
      }
      currentGroup.push(day);
    });
    if (currentGroup.length) groups.push({ weekLabel: this.buildWeekLabel(currentGroup), days: currentGroup });
    return groups;
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadAvailability();
    this.loadTimetable();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Schedule setup ─────────────────────────────────────────────────────────

  openScheduleSetup(): void {
    const configured = new Set(this.availability().map(a => a.dayOfWeek));
    this.dayConfigs.forEach(d => {
      d.selected = configured.has(d.dow);
      const existing = this.availability().find(a => a.dayOfWeek === d.dow);
      if (existing) {
        d.startTime = existing.startTime;
        d.endTime   = existing.endTime;
        // NOTE: no slotDurationMinutes here — removed per requirements
      }
    });
    this.scheduleDialogVisible = true;
  }

  saveSchedule(): void {
    const selected = this.dayConfigs.filter(d => d.selected);
    if (!selected.length) {
      this.msg.add({ severity: 'warn', summary: 'Attention', detail: 'Sélectionnez au moins un jour de travail.' });
      return;
    }

    this.savingSchedule.set(true);

    const saves$ = selected.map(d =>
      this.svc.setAvailability(this.doctorId, {
        dayOfWeek: d.dow,
        startTime: d.startTime,
        endTime:   d.endTime,
      })
    );

    const toDelete = this.dayConfigs
      .filter(d => !d.selected)
      .map(d => d.dow)
      .filter(dow => this.availability().some(a => a.dayOfWeek === dow));

    import('rxjs').then(({ forkJoin, of }) => {
      const deletes$ = toDelete.map(dow => this.svc.deleteAvailability(this.doctorId, dow));
      const all$     = [...saves$, ...deletes$];

      forkJoin(all$.length ? all$ : [of(null)])
        .pipe(takeUntil(this.destroy$), finalize(() => this.savingSchedule.set(false)))
        .subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Planning enregistré', detail: 'Vos jours de travail ont été mis à jour.' });
            this.scheduleDialogVisible = false;
            this.loadAvailability();
            this.loadTimetable();
          },
          error: () => this.msg.add({ severity: 'error', summary: 'Erreur', detail: "Impossible d'enregistrer le planning." }),
        });
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  setRange(range: TimetableRange): void {
    this.selectedRange.set(range);
    this.loadTimetable();
  }

  navigateWindow(dir: -1 | 1): void {
    const curr = new Date(this.windowStart());
    const days = this.selectedRange() === '1week' ? 7 : this.selectedRange() === '1month' ? 30 : 90;
    curr.setDate(curr.getDate() + dir * days);
    this.windowStart.set(curr);
    this.loadTimetable();
  }

  goToToday(): void {
    this.windowStart.set(new Date());
    this.loadTimetable();
  }

  // ── Slot interaction ───────────────────────────────────────────────────────

  onSlotClick(slot: TimetableSlot): void {
    this.selectedSlot.set(slot);
    this.slotDialogVisible = true;
  }

  confirmSlot(): void {
    const slot = this.selectedSlot();
    if (!slot?.appointment) return;

    const appt = slot.appointment as any;
    const req: AppointmentRequest = {
      patientId:        String(appt.patientId),
      doctorId:         String(appt.doctorId),
      dateTime:         appt.dateTime,
      patientEmail:     appt.patientEmail ?? '',
      patientFirstName: appt.patientFirstName ?? '',
    };

    this.svc.confirmAppointment(slot.appointment.id, req)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.msg.add({ severity: 'success', summary: 'Rendez-vous confirmé' });
          this.slotDialogVisible = false;
          this.loadTimetable();
        },
        error: () => this.msg.add({ severity: 'error', summary: 'Erreur', detail: 'Confirmation impossible.' }),
      });
  }

  cancelSlot(): void {
    const slot = this.selectedSlot();
    if (!slot?.appointment) return;

    const appt = slot.appointment as any;
    const req: AppointmentRequest = {
      patientId:        String(appt.patientId),
      doctorId:         String(appt.doctorId),
      dateTime:         appt.dateTime,
      patientEmail:     appt.patientEmail ?? '',
      patientFirstName: appt.patientFirstName ?? '',
    };

    this.svc.cancelAppointment(slot.appointment.id, req)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.msg.add({ severity: 'info', summary: 'Rendez-vous annulé' });
          this.slotDialogVisible = false;
          this.loadTimetable();
        },
        error: () => this.msg.add({ severity: 'error', summary: 'Erreur', detail: 'Annulation impossible.' }),
      });
  }

  // ── Template helpers ───────────────────────────────────────────────────────

  getSlot(day: TimetableDay, time: string): TimetableSlot | undefined {
    return day.slots.find(s => s.time === time);
  }

  isToday(dateStr: string): boolean {
    return dateStr === this.svc.toDateStr(new Date());
  }

  countDayAppointments(day: TimetableDay): number {
    return day.slots.filter(s => s.state === 'confirmed' || s.state === 'pending').length;
  }

  /**
   * Returns the patient's full name from the appointment attached to a slot.
   * Falls back to the parent @Input appointments[] array for richer data,
   * then to a short UUID excerpt.
   */
  slotPatientName(slot: TimetableSlot): string {
    if (!slot.appointment) return '';
    const appt = slot.appointment as any;

    // Prefer explicit name fields set on the appointment (from the backend JOIN)
    if (appt.patientFirstName) {
      return `${appt.patientFirstName} ${appt.patientLastName ?? ''}`.trim();
    }

    // Try to look up in the passed-in appointments list which may carry richer data
    const rich = this.appointments.find(a => a.id === appt.id) as any;
    if (rich?.patientFirstName) {
      return `${rich.patientFirstName} ${rich.patientLastName ?? ''}`.trim();
    }

    return `Patient #${String(appt.patientId).slice(0, 6)}`;
  }

  slotTypeLabel(slot: TimetableSlot): string {
    const type = (slot.appointment as any)?.appointmentType;
    const map: Record<string, string> = {
      CONSULTATION: 'Consultation',
      CHECKUP:      'Bilan',
      SURGERY:      'Chirurgie',
      FOLLOW_UP:    'Suivi',
    };
    return type ? (map[type] ?? type) : 'Consultation';
  }

  slotTypeClass(slot: TimetableSlot): string {
    const type = (slot.appointment as any)?.appointmentType ?? 'CONSULTATION';
    const map: Record<string, string> = {
      CONSULTATION: 'type-consult',
      CHECKUP:      'type-checkup',
      SURGERY:      'type-surgery',
      FOLLOW_UP:    'type-followup',
    };
    return map[type] ?? 'type-consult';
  }

  stateLabel(state: string): string {
    const map: Record<string, string> = {
      available: 'Disponible',
      pending:   'En attente',
      confirmed: 'Confirmé',
      completed: 'Terminé',
      cancelled: 'Annulé',
    };
    return map[state] ?? state;
  }

  stateSeverity(state: string): 'success' | 'warn' | 'info' | 'secondary' | 'danger' {
    const map: Record<string, any> = {
      available: 'success',
      pending:   'warn',
      confirmed: 'info',
      completed: 'secondary',
      cancelled: 'danger',
    };
    return map[state] ?? 'secondary';
  }

  dayLabel(dow: DayOfWeek): string {
    return this.dayConfigs.find(d => d.dow === dow)?.label ?? dow;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private loadAvailability(): void {
    if (!this.doctorId) return;
    this.loadingAvailability.set(true);
    this.svc.getAvailability(this.doctorId)
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingAvailability.set(false)))
      .subscribe({
        next: data => this.availability.set(data),
        error: ()  => this.availability.set([]),
      });
  }

  private loadTimetable(): void {
    if (!this.doctorId) return;
    this.loadingTimetable.set(true);
    this.svc.buildTimetable(
      this.doctorId,
      this.windowStart(),
      this.selectedRange(),
      this.appointments,
      true  // doctorViewMode = true → appointments attached to slots
    ).pipe(takeUntil(this.destroy$), finalize(() => this.loadingTimetable.set(false)))
    .subscribe({
      next: days => this.timetable.set(days),
      error: ()  => this.timetable.set([]),
    });
  }

  private buildWeekLabel(days: TimetableDay[]): string {
    if (!days.length) return '';
    const first = new Date(days[0].date);
    const last  = new Date(days[days.length - 1].date);
    const fmt   = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `Semaine du ${fmt(first)} au ${fmt(last)}`;
  }
}