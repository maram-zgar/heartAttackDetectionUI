// patient-booking.component.ts
import {
  Component, OnInit, OnDestroy, OnChanges, SimpleChanges,
  inject, signal, computed, Input, Output, EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { ButtonModule }   from 'primeng/button';
import { TooltipModule }  from 'primeng/tooltip';
import { ToastModule }    from 'primeng/toast';
import { TagModule }      from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { Skeleton }       from 'primeng/skeleton';
import { DialogModule }   from 'primeng/dialog';
import { SelectModule }   from 'primeng/select';

import {
  AvailabilityTimetableService,
  TimetableDay,
  TimetableSlot,
  TimetableRange,
  AppointmentRequest,
  AppointmentType,
} from '../../../../core/http/availability-timetable.service';

interface SelectOption<T> { label: string; value: T; }

const RANGE_OPTIONS: SelectOption<TimetableRange>[] = [
  { label: 'Semaine suivante', value: '1week'  },
  { label: 'Mois suivant',     value: '1month' },
];

const APPOINTMENT_TYPE_OPTIONS: SelectOption<AppointmentType>[] = [
  { label: 'Consultation',          value: 'CONSULTATION' },
  { label: 'Bilan de santé',        value: 'CHECKUP'      },
  { label: 'Suivi post-opératoire', value: 'FOLLOW_UP'    },
];

@Component({
  selector: 'app-patient-booking',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, TooltipModule, ToastModule, TagModule, Skeleton,
    DialogModule, SelectModule,
  ],
  providers: [MessageService],
  templateUrl: './patient-booking.component.html',
  styleUrls: ['./patient-booking.component.scss'],
})
export class PatientBookingComponent implements OnInit, OnChanges, OnDestroy {

  @Input() doctorId!: string;
  @Input() patientId!: string;
  @Input() patientEmail!: string;
  @Input() patientFirstName!: string;
  @Input() patientLastName = '';
  @Input() doctorFirstName = '';
  @Input() doctorLastName  = '';
  @Input() doctorSpecialty = 'Cardiologie';

  @Output() rescheduleRequested = new EventEmitter<string>();
  @Output() appointmentBooked   = new EventEmitter<void>();

  private readonly svc      = inject(AvailabilityTimetableService);
  private readonly msg      = inject(MessageService);
  private readonly destroy$ = new Subject<void>();

  readonly rangeOptions           = RANGE_OPTIONS;
  readonly appointmentTypeOptions = APPOINTMENT_TYPE_OPTIONS;

  readonly loading       = signal(false);
  readonly booking       = signal(false);
  readonly timetable     = signal<TimetableDay[]>([]);
  readonly selectedRange = signal<TimetableRange>('1week');
  readonly windowStart   = signal(new Date());
  readonly selectedSlot  = signal<TimetableSlot | null>(null);
  readonly pendingSlot   = signal<TimetableSlot | null>(null);

  bookingDialogVisible  = false;
  ownSlotDialogVisible  = false;
  selectedAppointmentType: AppointmentType = 'CONSULTATION';

  // ── Computed doctor display ──────────────────────────────────────────────

  readonly doctorName = computed(() =>
    `${this.doctorFirstName} ${this.doctorLastName}`.trim() || 'Médecin'
  );

  readonly doctorInitials = computed(() =>
    ((this.doctorFirstName?.[0] ?? '') + (this.doctorLastName?.[0] ?? '')).toUpperCase() || 'MD'
  );

  readonly timeRows = computed<string[]>(() => {
    const set = new Set<string>();
    this.timetable().forEach(d => {
      if (d.isWorkDay) d.slots.forEach(s => set.add(s.time));
    });
    return [...set].sort();
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    if (this.doctorId) this.loadTimetable();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Re-fetch timetable whenever doctorId changes (after first init)
    if (changes['doctorId'] && !changes['doctorId'].firstChange && this.doctorId) {
      this.resetState();
      this.loadTimetable();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  setRange(range: TimetableRange): void {
    this.selectedRange.set(range);
    this.selectedSlot.set(null);
    this.loadTimetable();
  }

  navigate(dir: -1 | 1): void {
    const curr = new Date(this.windowStart());
    curr.setDate(curr.getDate() + dir * (this.selectedRange() === '1week' ? 7 : 30));
    this.windowStart.set(curr);
    this.selectedSlot.set(null);
    this.loadTimetable();
  }

  goToToday(): void {
    this.windowStart.set(new Date());
    this.selectedSlot.set(null);
    this.loadTimetable();
  }

  // ── Slot interactions ─────────────────────────────────────────────────────

  openBookingDialog(slot: TimetableSlot): void {
    if (slot.state !== 'available') return;
    this.pendingSlot.set(slot);
    this.selectedAppointmentType = 'CONSULTATION';
    this.bookingDialogVisible = true;
  }

  onOwnSlotClick(slot: TimetableSlot): void {
    this.selectedSlot.set(slot);
    this.ownSlotDialogVisible = true;
  }

  confirmBooking(): void {
    const slot = this.pendingSlot();
    if (!slot) return;

    const request: AppointmentRequest = {
      patientId:        this.patientId,
      doctorId:         this.doctorId,
      dateTime:         slot.dateTime,
      patientEmail:     this.patientEmail,
      patientFirstName: this.patientFirstName,
      appointmentType:  this.selectedAppointmentType,
    };

    this.booking.set(true);
    this.svc.createAppointment(request)
      .pipe(takeUntil(this.destroy$), finalize(() => this.booking.set(false)))
      .subscribe({
        next: () => {
          this.msg.add({
            severity: 'success',
            summary: 'Rendez-vous demandé',
            detail: `Votre demande pour le ${this.formatSlotDate(slot)} à ${slot.time} a été envoyée.`,
            life: 6000,
          });
          this.bookingDialogVisible = false;
          this.pendingSlot.set(null);
          this.loadTimetable();
          this.appointmentBooked.emit();
        },
        error: err => {
          this.msg.add({
            severity: 'error',
            summary: 'Erreur',
            detail: err?.error?.message ?? 'Impossible de réserver ce créneau.',
          });
        },
      });
  }

  rescheduleOwn(): void {
    const slot = this.selectedSlot();
    if (!slot?.appointment) return;
    this.ownSlotDialogVisible = false;
    this.rescheduleRequested.emit((slot.appointment as any).id);
  }

  cancelOwn(): void {
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
          this.ownSlotDialogVisible = false;
          this.selectedSlot.set(null);
          this.loadTimetable();
          this.appointmentBooked.emit();
        },
        error: () => this.msg.add({ severity: 'error', summary: 'Erreur', detail: 'Annulation impossible.' }),
      });
  }

  // ── Template helpers ──────────────────────────────────────────────────────

  isToday(dateStr: string): boolean {
    return dateStr === this.svc.toDateStr(new Date());
  }

  getSlot(day: TimetableDay, time: string): TimetableSlot | undefined {
    return day.slots.find(s => s.time === time);
  }

  countFreeSlots(day: TimetableDay): number {
    return day.slots.filter(s => s.state === 'available').length;
  }

  formatSlotDate(slot: TimetableSlot): string {
    return new Date(slot.date).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING:   'En attente',
      CONFIRMED: 'Confirmé',
      CANCELLED: 'Annulé',
      COMPLETED: 'Terminé',
    };
    return map[status] ?? status;
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
    const type: AppointmentType = (slot.appointment as any)?.appointmentType ?? 'CONSULTATION';
    const classes: Record<AppointmentType, string> = {
      CONSULTATION: 'type-consult',
      CHECKUP:      'type-checkup',
      SURGERY:      'type-surgery',
      FOLLOW_UP:    'type-followup',
    };
    return classes[type];
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private resetState(): void {
    this.selectedSlot.set(null);
    this.pendingSlot.set(null);
    this.timetable.set([]);
    this.windowStart.set(new Date());
    this.selectedRange.set('1week');
    this.bookingDialogVisible = false;
    this.ownSlotDialogVisible = false;
  }

  private loadTimetable(): void {
    if (!this.doctorId) return;
    this.loading.set(true);

    this.svc.buildPatientTimetable(this.doctorId, this.windowStart(), this.selectedRange())
      .pipe(takeUntil(this.destroy$), finalize(() => this.loading.set(false)))
      .subscribe({
        next: days => {
          // Map slots: patient only sees their own appointments OR available/taken
          const mapped = days.map(day => ({
            ...day,
            slots: day.slots.map(slot => {
              // Available slot — keep as-is
              if (slot.state === 'available') return slot;

              // Booked slot — check if it belongs to this patient
              const appt = slot.appointment as any;
              const isOwn = appt && String(appt.patientId) === String(this.patientId);

              if (isOwn) {
                // Show own appointment with amber/green highlight
                return { ...slot };
              }

              // Someone else's slot — show as taken (no appointment data exposed)
              return {
                ...slot,
                state: 'confirmed' as const, // reuse confirmed state for "taken"
                appointment: undefined,       // NEVER expose other patient's data
              };
            }),
          }));
          this.timetable.set(mapped);
        },
        error: () => {
          this.timetable.set([]);
          this.msg.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Impossible de charger le planning.',
          });
        },
      });
  }
}