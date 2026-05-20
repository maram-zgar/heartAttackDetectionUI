import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  Input,
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
import { Output, EventEmitter } from '@angular/core';

import {
  AvailabilityTimetableService,
  TimetableDay,
  TimetableSlot,
  TimetableRange,
  AppointmentRequest,
} from '../../../../core/http/availability-timetable.service';
import { DialogModule } from 'primeng/dialog';


// ─────────────────────────────────────────────────────────────────────────────

interface SelectOption<T> { label: string; value: T; }

const RANGE_OPTIONS: SelectOption<TimetableRange>[] = [
  { label: 'Semaine suivante', value: '1week'   },
  { label: 'Mois suivant',    value: '1month'  },
];

// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-patient-booking',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, TooltipModule, ToastModule, TagModule, Skeleton,
    DialogModule
  ],
  providers: [MessageService],
  template: `
<p-toast position="top-right" />

<p-dialog
  [(visible)]="ownSlotDialogVisible"
  [modal]="true" [draggable]="false" [closable]="true"
  [style]="{ width: '380px' }"
  styleClass="tt-dialog"
  header="Mon rendez-vous"
>
  @if (selectedSlot()?.appointment) {
    <div class="tt-slot-detail">
      <div class="tt-slot-detail-row">
        <i class="pi pi-calendar"></i>
        <span>{{ selectedSlot()!.date | date:'EEEE d MMMM yyyy':'':'fr-FR' }}</span>
      </div>
      <div class="tt-slot-detail-row">
        <i class="pi pi-clock"></i>
        <span>{{ selectedSlot()!.time }}</span>
      </div>
      <div class="tt-slot-detail-row">
        <i class="pi pi-tag"></i>
        <span>{{ slotTypeLabel(selectedSlot()!) }}</span>
      </div>
      <div class="tt-slot-detail-row">
        <p-tag
          [value]="statusLabel(selectedSlot()!.appointment!.status ?? '')"
          [severity]="selectedSlot()!.appointment!.status === 'CONFIRMED' ? 'success' :
                      selectedSlot()!.appointment!.status === 'PENDING'   ? 'warn'    :
                      selectedSlot()!.appointment!.status === 'CANCELLED' ? 'danger'  : 'secondary'"
        />
      </div>

      @if (selectedSlot()!.appointment!.status === 'PENDING' || selectedSlot()!.appointment!.status === 'CONFIRMED') {
        <div class="tt-slot-actions">
          <button type="button" class="tt-btn-confirm" (click)="rescheduleOwn()">
            <i class="pi pi-calendar-clock"></i> Reprogrammer
          </button>
          <button type="button" class="tt-btn-cancel" (click)="cancelOwn()">
            <i class="pi pi-times"></i> Annuler
          </button>
        </div>
      }
    </div>
  }
</p-dialog>

<div class="pt-booking-wrapper">

  <!-- ── Doctor card ── -->
  <div class="pt-doctor-card">
    <div class="pt-doctor-avatar">{{ doctorInitials() }}</div>
    <div class="pt-doctor-info">
      <h3>Dr. {{ doctorName() }}</h3>
      <p>{{ doctorSpecialty }}</p>
    </div>
    <div style="margin-left: auto; display: flex; align-items: center; gap: .5rem;">
      <span class="tt-state-badge available" style="font-size:.75rem">
        <i class="pi pi-circle-fill" style="font-size:.5rem; margin-right:.375rem"></i>
        Prend des rendez-vous
      </span>
    </div>
  </div>

  <!-- ── Header ── -->
  <div class="tt-header">
    <div class="tt-header-left">
      <div class="tt-title-block">
        <span class="tt-icon"><i class="pi pi-calendar-plus"></i></span>
        <div>
          <h2 class="tt-title">Prendre un rendez-vous</h2>
          <p class="tt-subtitle">Sélectionnez un créneau vert disponible</p>
        </div>
      </div>
    </div>

    <div class="tt-header-right">
      <div class="tt-range-group">
        @for (opt of rangeOptions; track opt.value) {
          <button
            type="button"
            class="tt-range-btn"
            [class.active]="selectedRange() === opt.value"
            (click)="setRange(opt.value)"
          >{{ opt.label }}</button>
        }
      </div>

      <div class="tt-nav-controls">
        <button type="button" class="tt-nav-btn" (click)="navigate(-1)" pTooltip="Précédent">
          <i class="pi pi-chevron-left"></i>
        </button>
        <button type="button" class="tt-today-btn" (click)="goToToday()">Aujourd'hui</button>
        <button type="button" class="tt-nav-btn" (click)="navigate(1)" pTooltip="Suivant">
          <i class="pi pi-chevron-right"></i>
        </button>
      </div>
    </div>
  </div>

  <!-- ── Legend (patient view) ── -->
  <div class="tt-legend">
    <span class="tt-legend-item available"><span class="tt-dot"></span>Disponible — cliquez pour sélectionner</span>
    <span class="tt-legend-item confirmed"><span class="tt-dot" style="background:rgba(239,68,68,.5)"></span>Déjà réservé</span>
    <span class="tt-legend-item blocked"><span class="tt-dot"></span>Hors horaires</span>
  </div>

  <!-- ── Selected slot confirmation bar ── -->
  @if (selectedSlot()) {
    <div class="pt-booking-panel">
      <div class="pt-booking-info">
        <span class="pt-booking-label">Créneau sélectionné</span>
        <span class="pt-booking-value">
          {{ formatSelectedDate() }} à {{ selectedSlot()!.time }}
        </span>
      </div>
      <div style="display:flex; gap:.75rem; align-items:center;">
        <button type="button" class="tt-btn-secondary" (click)="clearSelection()" style="font-size:.875rem;">
          <i class="pi pi-times"></i> Annuler
        </button>
        <button
          type="button"
          class="pt-confirm-btn"
          [disabled]="booking()"
          (click)="confirmBooking()"
        >
          @if (booking()) {
            <i class="pi pi-spin pi-spinner"></i> En cours...
          } @else {
            <i class="pi pi-check-circle"></i> Confirmer le rendez-vous
          }
        </button>
      </div>
    </div>
  }

  <!-- ── Timetable grid ── -->
  <div class="tt-grid-container">
    @if (loading()) {
      <p-skeleton height="400px" borderRadius="16px" />
    } @else if (timetable().length === 0) {
      <div class="tt-empty-state">
        <i class="pi pi-calendar-times"></i>
        <p>Aucune disponibilité pour cette période.</p>
      </div>
    } @else {
      <div class="tt-cal-grid" [style.--col-count]="timetable().length">

        <!-- Corner -->
        <div class="tt-corner"></div>

        <!-- Day headers -->
        @for (day of timetable(); track day.date) {
          <div class="tt-day-header"
            [class.today]="isToday(day.date)"
            [class.workday]="day.isWorkDay">
            <span class="tt-day-name">{{ day.label }}</span>
            @if (day.isWorkDay) {
              <span class="tt-day-appt-count">
                {{ countFreeSlots(day) }} libre(s)
              </span>
            } @else {
              <span class="tt-day-off">Repos</span>
            }
          </div>
        }

        <!-- Time rows -->
        @for (timeRow of timeRows(); track timeRow) {
          <div class="tt-time-label">{{ timeRow }}</div>

          @for (day of timetable(); track day.date) {
            @if (!day.isWorkDay) {
              <div class="tt-cell tt-cell--off"></div>
            } @else {
              @let slot = getSlot(day, timeRow);
              @if (slot) {
                @if (slot.state === 'available') {
                  <div
                    class="tt-cell tt-cell--free"
                    [class.selected]="isSelected(slot)"
                    (click)="onSlotClick(slot)"
                    [pTooltip]="'Réserver ' + slot.time"
                    tooltipPosition="top"
                  >
                    <span class="tt-cell-time-label">{{ slot.time }}</span>
                  </div>
                } @else if (slot.appointment) {
                  <!-- Own appointment: clickable, shows status and type -->
                  <div
                    class="tt-cell tt-cell--booked"
                    [ngClass]="[slot.state, slotTypeClass(slot)]"
                    (click)="onOwnSlotClick(slot)"
                    [pTooltip]="statusLabel(slot.appointment.status ?? '') + ' · ' + slotTypeLabel(slot)"
                    tooltipPosition="top"
                    style="cursor: pointer;"
                  >
                    <span class="tt-cell-type-tag">{{ slotTypeLabel(slot) }}</span>
                    <span class="tt-cell-status-tag" style="font-size:.6rem; opacity:.75;">
                      {{ statusLabel(slot.appointment.status ?? '') }}
                    </span>
                    @if (slot.state === 'pending') {
                      <span class="tt-cell-pulse"></span>
                    }
                  </div>
                } @else {
                  <!-- Another patient's slot: greyed out, not clickable -->
                  <div
                    class="tt-cell tt-cell--booked unavailable"
                    pTooltip="Indisponible"
                    tooltipPosition="top"
                    style="cursor: default; opacity: .45;"
                  >
                    <i class="pi pi-lock" style="font-size:.55rem;"></i>
                  </div>
                }
              } @else {
                <div class="tt-cell tt-cell--empty"></div>
              }
            }
          }
        }

      </div>
    }
  </div>

</div>
  `,
  styleUrls: ['../../../doctor/components/timetable/doctor-timetable.component.scss']
})
export class PatientBookingComponent implements OnInit, OnDestroy {

  /** Doctor whose timetable is being shown */
  @Input() doctorId!: string;

  /** Patient performing the booking */
  @Input() patientId!: string;
  @Input() patientEmail!: string;
  @Input() patientFirstName!: string;
  @Input() patientLastName = '';

  /** Display info for the doctor card */
  @Input() doctorFirstName = '';
  @Input() doctorLastName  = '';
  @Input() doctorSpecialty: string = 'Cardiologie';

  @Output() rescheduleRequested = new EventEmitter<string>();
  @Output() appointmentBooked = new EventEmitter<void>();

  private readonly svc = inject(AvailabilityTimetableService);
  private readonly msg = inject(MessageService);
  private readonly destroy$ = new Subject<void>();

  readonly rangeOptions = RANGE_OPTIONS;

  // ── Signals ────────────────────────────────────────────────────────────────
  readonly loading       = signal(false);
  readonly booking       = signal(false);
  readonly timetable     = signal<TimetableDay[]>([]);
  readonly selectedRange = signal<TimetableRange>('1week');
  readonly windowStart   = signal(new Date());
  readonly selectedSlot  = signal<TimetableSlot | null>(null);
  readonly ownSlotDialogVisible = signal(false);

  // ── Computed ───────────────────────────────────────────────────────────────

  readonly doctorName = computed(() =>
    `${this.doctorFirstName} ${this.doctorLastName}`.trim() || 'Médecin'
  );

  readonly doctorInitials = computed(() => {
    const f = this.doctorFirstName?.[0] ?? '';
    const l = this.doctorLastName?.[0]  ?? '';
    return (f + l).toUpperCase() || 'MD';
  });

  readonly timeRows = computed<string[]>(() => {
    const set = new Set<string>();
    this.timetable().forEach(d => d.slots.forEach(s => set.add(s.time)));
    return [...set].sort();
  });

  readonly weekGroups = computed(() => {
    const groups: { weekLabel: string; days: TimetableDay[] }[] = [];
    let currentWeek = -1;
    let currentGroup: TimetableDay[] = [];

    this.timetable().forEach(day => {
      const d = new Date(day.date);
      const wk = this.svc.getWeekNumber(d);
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
    this.loadTimetable();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  setRange(range: TimetableRange): void {
    this.selectedRange.set(range);
    this.clearSelection();
    this.loadTimetable();
  }

  navigate(dir: -1 | 1): void {
    const curr = new Date(this.windowStart());
    const days = this.selectedRange() === '1week' ? 7 : 30;
    curr.setDate(curr.getDate() + dir * days);
    this.windowStart.set(curr);
    this.clearSelection();
    this.loadTimetable();
  }

  goToToday(): void {
    this.windowStart.set(new Date());
    this.clearSelection();
    this.loadTimetable();
  }

  onSlotClick(slot: TimetableSlot): void {
    if (slot.state !== 'available') return;
    this.selectedSlot.set(slot);
  }

  clearSelection(): void {
    this.selectedSlot.set(null);
  }

  confirmBooking(): void {
    const slot = this.selectedSlot();
    if (!slot) return;

    const request: AppointmentRequest = {
      patientId:        this.patientId,
      doctorId:         this.doctorId,
      dateTime:         slot.dateTime,
      patientEmail:     this.patientEmail,
      patientFirstName: this.patientFirstName,
    };

    this.booking.set(true);
    this.svc.createAppointment(request)
      .pipe(takeUntil(this.destroy$), finalize(() => this.booking.set(false)))
      .subscribe({
        next: () => {
          this.msg.add({
            severity: 'success',
            summary: 'Rendez-vous demandé !',
            detail: `Votre demande pour le ${this.formatSelectedDate()} à ${slot.time} a été envoyée. Le médecin vous confirmera prochainement.`,
            life: 6000,
          });
          this.selectedSlot.set(null);
          this.loadTimetable(); // refresh to mark slot as pending
          this.appointmentBooked.emit();
        },
        error: (err) => {
          const msg = err?.error?.message ?? 'Impossible de réserver ce créneau. Veuillez réessayer.';
          this.msg.add({ severity: 'error', summary: 'Erreur', detail: msg });
        },
      });
  }

  // ── Template helpers ───────────────────────────────────────────────────────

  isSelected(slot: TimetableSlot): boolean {
    return this.selectedSlot()?.dateTime === slot.dateTime;
  }

  isToday(dateStr: string): boolean {
    return dateStr === this.svc.toDateStr(new Date());
  }

  getSlot(day: TimetableDay, time: string): TimetableSlot | undefined {
    return day.slots.find(s => s.time === time);
  }

  countFreeSlots(day: TimetableDay): number {
    return day.slots.filter(s => s.state === 'available').length;
  }

  formatSelectedDate(): string {
    const slot = this.selectedSlot();
    if (!slot) return '';
    return new Date(slot.date).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
  }

  onOwnSlotClick(slot: TimetableSlot): void {
    this.selectedSlot.set(slot);
    this.ownSlotDialogVisible.set(true);
  }

  rescheduleOwn(): void {
    const slot = this.selectedSlot();
    if (!slot?.appointment) return;
    this.ownSlotDialogVisible.set(false);
    // emit the appointment id so the parent opens the reschedule dialog
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
          this.ownSlotDialogVisible.set(false);
          this.selectedSlot.set(null);
          this.loadTimetable();
          this.appointmentBooked.emit(); // refresh parent list too
        },
        error: () => this.msg.add({ severity: 'error', summary: 'Erreur', detail: 'Annulation impossible.' }),
      });
  }

  slotTypeLabel(slot: TimetableSlot): string {
    const type = (slot.appointment as any)?.appointmentType;
    const map: Record<string, string> = {
      CONSULTATION: 'Consultation', CHECKUP: 'Bilan',
      SURGERY: 'Chirurgie', FOLLOW_UP: 'Suivi',
    };
    return type ? (map[type] ?? type) : 'Consultation';
  }

  slotTypeClass(slot: TimetableSlot): string {
    const type = (slot.appointment as any)?.appointmentType ?? 'CONSULTATION';
    const map: Record<string, string> = {
      CONSULTATION: 'type-consult', CHECKUP: 'type-checkup',
      SURGERY: 'type-surgery', FOLLOW_UP: 'type-followup',
    };
    return map[type] ?? 'type-consult';
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'En attente', CONFIRMED: 'Confirmé',
      CANCELLED: 'Annulé', COMPLETED: 'Terminé',
    };
    return map[status] ?? status;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private loadTimetable(): void {
    // Defensive: ensure doctorId is present before loading
    if (!this.doctorId) {
      this.timetable.set([]);
      this.loading.set(false);
      this.msg.add({ severity: 'error', summary: 'Erreur', detail: 'Aucun médecin sélectionné.' });
      return;
    }
    this.loading.set(true);
    // Always cap range to 1month max
    const range = this.selectedRange() === '1week' ? '1week' : '1month';
    this.svc.buildPatientTimetable(this.doctorId, this.windowStart(), range)
      .pipe(takeUntil(this.destroy$), finalize(() => this.loading.set(false)))
      .subscribe({
        next: days => this.timetable.set(
          days.map(day => ({
            ...day,
            slots: day.slots.map(slot => {
              if (slot.state === 'available') return slot;
              const appt = slot.appointment as any;
              const isOwn = appt && String(appt.patientId) === String(this.patientId);
              return {
                ...slot,
                state: isOwn ? slot.state : 'unavailable' as any,
                appointment: isOwn ? slot.appointment : undefined,
              };
            })
          }))
        ),
        error: ()  => {
          this.timetable.set([]);
          this.msg.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger le planning.' });
        },
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
