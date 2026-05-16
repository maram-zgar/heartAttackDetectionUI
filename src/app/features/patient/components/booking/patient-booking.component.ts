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

import {
  AvailabilityTimetableService,
  TimetableDay,
  TimetableSlot,
  TimetableRange,
  AppointmentRequest,
} from '../../../../core/http/availability-timetable.service';

// ─────────────────────────────────────────────────────────────────────────────

interface SelectOption<T> { label: string; value: T; }

const RANGE_OPTIONS: SelectOption<TimetableRange>[] = [
  { label: 'Semaine suivante', value: '1week'   },
  { label: 'Mois suivant',    value: '1month'  },
  { label: '3 mois suivants', value: '3months' },
];

// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-patient-booking',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, TooltipModule, ToastModule, TagModule, Skeleton,
  ],
  providers: [MessageService],
  template: `
<p-toast position="top-right" />

<div class="pt-booking-wrapper">

  <!-- ── Doctor card ── -->
  <div class="pt-doctor-card">
    <div class="pt-doctor-avatar">{{ doctorInitials() }}</div>
    <div class="pt-doctor-info">
      <h3>Dr. {{ doctorName() }}</h3>
      <p>{{ doctorSpecialty() }}</p>
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
      @for (group of weekGroups(); track group.weekLabel) {
        <div class="tt-week-section">
          <div class="tt-week-label">
            <span>{{ group.weekLabel }}</span>
          </div>

          <div class="tt-grid" [style.--col-count]="group.days.length">

            <!-- Day headers -->
            @for (day of group.days; track day.date) {
              <div
                class="tt-day-header"
                [class.work-day]="day.isWorkDay"
                [class.today]="isToday(day.date)"
              >
                <span class="tt-day-header-name">{{ day.label }}</span>
                @if (!day.isWorkDay) {
                  <span class="tt-day-off-badge">Repos</span>
                } @else {
                  <span class="tt-day-count-badge">
                    {{ countFreeSlots(day) }} libre{{ countFreeSlots(day) > 1 ? 's' : '' }}
                  </span>
                }
              </div>
            }

            <!-- Rows -->
            @for (timeRow of timeRows(); track timeRow) {
              <div class="tt-time-label">{{ timeRow }}</div>

              @for (day of group.days; track day.date) {
                @if (!day.isWorkDay) {
                  <div class="tt-cell tt-cell--off"></div>
                } @else {
                  @let slot = getSlot(day, timeRow);
                  @if (slot) {
                    <div
                      class="tt-cell tt-cell--slot"
                      [class.pt-cell--available]="slot.state === 'available'"
                      [class.pt-cell--taken]="slot.state !== 'available'"
                      [class.selected]="isSelected(slot)"
                      [pTooltip]="slot.state === 'available' ? 'Cliquez pour réserver ' + slot.time : 'Créneau déjà pris'"
                      tooltipPosition="top"
                      (click)="onSlotClick(slot)"
                    >
                      <span class="tt-cell-time">{{ slot.time }}</span>
                      @if (slot.state !== 'available') {
                        <i class="pi pi-lock" style="font-size:.5rem; opacity:.4;"></i>
                      }
                    </div>
                  } @else {
                    <div class="tt-cell tt-cell--empty"></div>
                  }
                }
              }
            }

          </div>
        </div>
      }
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
  @Input() doctorSpecialty = signal('Cardiologie');

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
    const days = this.selectedRange() === '1week' ? 7
               : this.selectedRange() === '1month' ? 30 : 90;
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

  // ── Private ────────────────────────────────────────────────────────────────

  private loadTimetable(): void {
    this.loading.set(true);
    this.svc.buildPatientTimetable(this.doctorId, this.windowStart(), this.selectedRange())
      .pipe(takeUntil(this.destroy$), finalize(() => this.loading.set(false)))
      .subscribe({
        next: days => this.timetable.set(days),
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
