import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';

// ─────────────────────────────────────────────────────────────────────────────
//  DTOs — mirror the backend Java records
// ─────────────────────────────────────────────────────────────────────────────

export type DayOfWeek =
  | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY'
  | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface DoctorAvailabilityRequest {
  dayOfWeek: DayOfWeek;
  /** 'HH:mm' e.g. '08:00' */
  startTime: string;
  /** 'HH:mm' e.g. '17:00' */
  endTime: string;
  /**
   * Optional — backend defaults to 30 min when omitted.
   * Doctors no longer set this during availability setup.
   */
}

export interface DoctorAvailabilityResponse {
  id: string;
  doctorId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface AvailableSlotsResponse {
  doctorId: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** ISO datetime strings e.g. '2025-06-16T09:00:00' */
  slots: string[];
}

export interface AppointmentResponse {
  id: string;
  patientId: string;
  doctorId: string;
  /** ISO datetime string */
  dateTime: string;
  status: 'PENDING' | 'CONFIRMED' | 'RESCHEDULED' | 'CANCELLED' | 'COMPLETED';
  patientFirstName?: string;
  patientLastName?:  string;
  patientEmail?:     string;
  appointmentType?:  AppointmentType;
}

export type AppointmentType = 'CONSULTATION' | 'CHECKUP' | 'SURGERY' | 'FOLLOW_UP';

export interface AppointmentRequest {
  patientId:         string;
  doctorId:          string;
  /** ISO datetime string e.g. '2025-06-16T09:00:00' */
  dateTime:          string;
  patientEmail:      string;
  patientFirstName:  string;
  appointmentType?:  AppointmentType;
}

// ─────────────────────────────────────────────────────────────────────────────
//  View-model types — used by the timetable components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One time-slot cell in the timetable grid.
 * `state` drives the CSS class and interactivity of the cell.
 */
export interface TimetableSlot {
  /** ISO datetime string — unique key for this slot */
  dateTime: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'HH:mm' */
  time: string;
  /**
   * available  — doctor works this slot, no booking
   * pending    — PENDING appointment (patient waiting for confirmation)
   * confirmed  — CONFIRMED appointment (slot locked)
   * completed  — past completed appointment
   * cancelled  — cancelled (shown as available again)
   * blocked    — outside doctor's working hours
   */
  state: 'available' | 'pending' | 'confirmed' | 'completed' | 'blocked' | 'cancelled';
  /** Full appointment object — doctor view only, never exposed to patient. */
  appointment?: AppointmentResponse;
}

/** One column in the timetable grid = one calendar day. */
export interface TimetableDay {
  /** 'YYYY-MM-DD' */
  date: string;
  /** Human-readable: 'Lun 16 juin' */
  label: string;
  dayOfWeek: DayOfWeek;
  /** True if the doctor has a schedule configured for this day. */
  isWorkDay: boolean;
  slots: TimetableSlot[];
}

/** The display window the user has selected. */
export type TimetableRange = '1week' | '1month' | '3months';

// ─────────────────────────────────────────────────────────────────────────────
//  Service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AvailabilityTimetableService
 *
 * Responsible for:
 *  1. CRUD on doctor availability (which days + hours the doctor works).
 *  2. Fetching available slots for a given date (patient-facing).
 *  3. Building the full TimetableDay[] view model consumed by both the
 *     doctor timetable component and the patient booking component.
 *
 * All URLs are relative — proxy.conf.json forwards /api/** to :8080.
 */
@Injectable({ providedIn: 'root' })
export class AvailabilityTimetableService {

  private readonly http = inject(HttpClient);

  private readonly appointmentsBase = 'http://localhost:8080/api/v1/appointments';

  private doctorAvailabilityUrl(doctorId: string): string {
    return `http://localhost:8080/api/v1/doctors/${doctorId}/availability`;
  }

  // ── Availability CRUD ─────────────────────────────────────────────────────

  /**
   * Upsert the availability for a specific day of week.
   * POST /api/v1/doctors/{doctorId}/availability
   */
  setAvailability(
    doctorId: string,
    request: DoctorAvailabilityRequest,
  ): Observable<DoctorAvailabilityResponse> {
    return this.http.post<DoctorAvailabilityResponse>(
      this.doctorAvailabilityUrl(doctorId),
      request,
    );
  }

  /**
   * Fetch all availability entries for a doctor.
   * GET /api/v1/doctors/{doctorId}/availability
   */
  getAvailability(doctorId: string): Observable<DoctorAvailabilityResponse[]> {
    return this.http.get<DoctorAvailabilityResponse[]>(
      this.doctorAvailabilityUrl(doctorId),
    );
  }

  /**
   * Remove availability for one day of week.
   * DELETE /api/v1/doctors/{doctorId}/availability/day?day=MONDAY
   */
  deleteAvailability(doctorId: string, day: DayOfWeek): Observable<void> {
    const params = new HttpParams().set('day', day);
    return this.http.delete<void>(
      `${this.doctorAvailabilityUrl(doctorId)}/day`,
      { params },
    );
  }

  // ── Available slots ───────────────────────────────────────────────────────

  /**
   * Returns available (not-yet-confirmed) slots for one specific date.
   * GET /api/v1/appointments/available-slots?doctorId=X&date=YYYY-MM-DD
   */
  getAvailableSlots(doctorId: string, date: string): Observable<AvailableSlotsResponse> {
    const params = new HttpParams()
      .set('doctorId', doctorId)
      .set('date', date);
    return this.http.get<AvailableSlotsResponse>(
      `http://localhost:8080/api/v1/appointments/available-slots`,
      { params },
    );
  }

  // ── Appointment actions ───────────────────────────────────────────────────

  /** POST /api/v1/appointments */
  createAppointment(request: AppointmentRequest): Observable<AppointmentResponse> {
    return this.http.post<AppointmentResponse>(`http://localhost:8080/api/v1/appointments`, request);
  }

  /** PATCH /api/v1/appointments/{id}/confirm */
  confirmAppointment(
    id: string,
    request: AppointmentRequest,
  ): Observable<AppointmentResponse> {
    return this.http.patch<AppointmentResponse>(
      `http://localhost:8080/api/v1/appointments/${id}/confirm`,
      request,
    );
  }

  /** PATCH /api/v1/appointments/{id}/cancel */
  cancelAppointment(
    id: string,
    request: AppointmentRequest,
  ): Observable<AppointmentResponse> {
    return this.http.patch<AppointmentResponse>(
      `http://localhost:8080/api/v1/appointments/${id}/cancel`,
      request,
    );
  }

  /** PUT /api/v1/appointments/{id}/reschedule */
  rescheduleAppointment(
    id: string,
    request: AppointmentRequest,
  ): Observable<AppointmentResponse> {
    return this.http.put<AppointmentResponse>(
      `http://localhost:8080/api/v1/appointments/${id}/reschedule`,
      request,
    );
  }

  // ── Timetable builders ────────────────────────────────────────────────────

  /**
   * Doctor view: builds the complete timetable for a date window.
   *
   * Strategy:
   *  1. Fetch the doctor's weekly availability (days + hours).
   *  2. Use the pre-fetched `appointments` array passed from the doctor state service.
   *  3. Generate every slot and colour it by appointment status.
   *
   * @param doctorId     UUID of the doctor whose timetable to build.
   * @param startDate    First date of the window.
   * @param range        '1week' | '1month' | '3months'.
   * @param appointments Pre-fetched appointment list from DoctorStateService.
   * @param doctorViewMode  true = attach appointment details to slots.
   */
  buildTimetable(
    doctorId: string,
    startDate: Date,
    range: TimetableRange,
    appointments: AppointmentResponse[],
    doctorViewMode: boolean,
  ): Observable<TimetableDay[]> {
    const dates = this.generateDateWindow(startDate, range);

    return this.getAvailability(doctorId).pipe(
      map(availabilities => {
        const availMap = new Map<DayOfWeek, DoctorAvailabilityResponse>(
          availabilities.map(a => [a.dayOfWeek, a]),
        );
        return dates.map(date =>
          this.buildDay(date, availMap, appointments, doctorViewMode),
        );
      }),
    );
  }

  /**
   * Patient view: fetches available slots per work-day and builds the timetable.
   * Patients never see other patients' data — only green/red slot colours.
   *
   * @param doctorId    UUID of the assigned doctor.
   * @param startDate   First date of the window.
   * @param range       '1week' | '1month' | '3months'.
   */
  buildPatientTimetable(
    doctorId: string,
    startDate: Date,
    range: TimetableRange,
    patientId: string,
  ): Observable<TimetableDay[]> {
    const dates = this.generateDateWindow(startDate, range);

    return this.getAvailability(doctorId).pipe(
      switchMap(availabilities => {
        const availMap = new Map<DayOfWeek, DoctorAvailabilityResponse>(
          availabilities.map(a => [a.dayOfWeek, a]),
        );

        const workDays = dates.filter(d => availMap.has(this.toDayOfWeek(d)));

        if (workDays.length === 0) {
          return of(dates.map(date => this.buildDay(date, availMap, [], false)));
        }

        const slotRequests = workDays.map(d =>
          this.getAvailableSlots(doctorId, this.toDateStr(d)),
        );

        return forkJoin([
          forkJoin(slotRequests),
          this.http.get<AppointmentResponse[]>(
            `http://localhost:8080/api/v1/appointments/patient/${patientId}`
          ),
        ]).pipe(
          map(([slotResponses, patientAppointments]) => {
            // Free slots returned by the backend (not CONFIRMED or PENDING)
            const availableSet = new Set<string>(
              slotResponses.flatMap(r => r.slots),
            );

            // Patient's own appointments indexed by normalised datetime key
            const ownByDateTime = new Map<string, AppointmentResponse>();
            patientAppointments.forEach(a => {
              const key = a.dateTime.substring(0, 16) + ':00';
              ownByDateTime.set(key, a);
            });

            return dates.map(date => {
              const dow   = this.toDayOfWeek(date);
              const avail = availMap.get(dow);

              if (!avail) {
                return {
                  date:      this.toDateStr(date),
                  label:     this.formatDayLabel(date),
                  dayOfWeek: dow,
                  isWorkDay: false,
                  slots:     [],
                } as TimetableDay;
              }

              const allSlots = this.generateSlots(date, avail);

              const slots: TimetableSlot[] = allSlots.map(slotDt => {
                const ownAppt = ownByDateTime.get(slotDt);

                // Slot belongs to this patient
                if (ownAppt && (ownAppt.status === 'PENDING' || ownAppt.status === 'CONFIRMED')) {
                  return {
                    dateTime:    slotDt,
                    date:        this.toDateStr(date),
                    time:        slotDt.substring(11, 16),
                    state:       ownAppt.status === 'PENDING' ? 'pending' : 'confirmed',
                    appointment: ownAppt,
                  } as TimetableSlot;
                }

                // Free or taken by someone else
                return {
                  dateTime:    slotDt,
                  date:        this.toDateStr(date),
                  time:        slotDt.substring(11, 16),
                  state:       availableSet.has(slotDt) ? 'available' : 'confirmed',
                  appointment: undefined,
                } as TimetableSlot;
              });

              return {
                date:      this.toDateStr(date),
                label:     this.formatDayLabel(date),
                dayOfWeek: dow,
                isWorkDay: true,
                slots,
              } as TimetableDay;
            });
          }),
        );
      }),
    );
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildDay(
    date: Date,
    availMap: Map<DayOfWeek, DoctorAvailabilityResponse>,
    appointments: AppointmentResponse[],
    doctorViewMode: boolean,
  ): TimetableDay {
    const dow     = this.toDayOfWeek(date);
    const avail   = availMap.get(dow);
    const dateStr = this.toDateStr(date);

    if (!avail) {
      return {
        date: dateStr, label: this.formatDayLabel(date),
        dayOfWeek: dow, isWorkDay: false, slots: [],
      };
    }

    const allSlotDateTimes = this.generateSlots(date, avail);

    // Index appointments by normalised ISO datetime key ('YYYY-MM-DDTHH:mm:00')
    const apptByDateTime = new Map<string, AppointmentResponse>();
    appointments
      .filter(a => a.dateTime.startsWith(dateStr))
      .forEach(a => {
        const key = a.dateTime.substring(0, 16) + ':00';
        apptByDateTime.set(key, a);
      });

    const slots: TimetableSlot[] = allSlotDateTimes.map(slotDt => {
      const appt = apptByDateTime.get(slotDt);
      let state: TimetableSlot['state'] = 'available';
      if (appt) {
        switch (appt.status) {
          case 'CONFIRMED':   state = 'confirmed';  break;
          case 'PENDING':     state = 'pending';    break;
          case 'COMPLETED':   state = 'completed';  break;
          case 'CANCELLED':   state = 'available';  break; // freed slot
          case 'RESCHEDULED': state = 'pending';    break;
        }
      }
      return {
        dateTime:    slotDt,
        date:        dateStr,
        time:        slotDt.substring(11, 16),
        state,
        appointment: doctorViewMode ? appt : undefined,
      };
    });

    return {
      date: dateStr, label: this.formatDayLabel(date),
      dayOfWeek: dow, isWorkDay: true, slots,
    };
  }

  /**
   * Generates all slot ISO datetime strings for a given day/availability.
   * e.g. ['2025-06-16T08:00:00', '2025-06-16T08:30:00', …]
   */
  private generateSlots(date: Date, avail: DoctorAvailabilityResponse): string[] {
    const slots: string[] = [];
    const dateStr = this.toDateStr(date);
    const SLOT_DURATION = 30; // always 30 min

    const [startH, startM] = this.parseTime(avail.startTime);
    const [endH, endM]     = this.parseTime(avail.endTime);

    const startTotalMin = startH * 60 + startM;
    const endTotalMin   = endH   * 60 + endM;

    if (startTotalMin >= endTotalMin) {
      return [];
    }

    let h = startH;
    let m = startM;

    while (h * 60 + m < endTotalMin) {
      slots.push(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
      m += SLOT_DURATION;
      h += Math.floor(m / 60);
      m  = m % 60;
    }

    return slots;
  }
  private parseTime(t: any): [number, number] {
    if (Array.isArray(t)) {
      return [Number(t[0]) || 0, Number(t[1]) || 0];
    }
    if (typeof t === 'string') {
      const parts = t.split(':').map(Number);
      return [parts[0] || 0, parts[1] || 0];
    }
    return [0, 0];
  }

  /** Generates an array of Date objects for the given window. */
  generateDateWindow(startDate: Date, range: TimetableRange): Date[] {
    const days  = range === '1week' ? 7 : range === '1month' ? 30 : 90;
    const dates = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  }

  /** Returns 'YYYY-MM-DD' string for a Date. */
  toDateStr(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Maps a JS Date to its DayOfWeek enum value. */
  toDayOfWeek(date: Date): DayOfWeek {
    const days: DayOfWeek[] = [
      'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY',
    ];
    return days[date.getDay()];
  }

  /** French short day label: 'lun. 16 juin' */
  formatDayLabel(date: Date): string {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  }

  /** ISO week number (ISO 8601). */
  getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
}