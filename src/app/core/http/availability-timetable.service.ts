import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, combineLatest, forkJoin, map, of, switchMap } from 'rxjs';

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
  slotDurationMinutes?: number;
}

export interface DoctorAvailabilityResponse {
  id: string;
  doctorId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
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
  /** Populated from the request payload or a backend join */
  patientFirstName?: string;
  patientLastName?:  string;
  patientEmail?:     string;
  appointmentType?:  AppointmentType;
  durationMinutes?:  number;
}

export type AppointmentType = 'CONSULTATION' | 'CHECKUP' | 'SURGERY' | 'FOLLOW_UP';

export interface AppointmentRequest {
  patientId: string;
  doctorId: string;
  /** ISO datetime string e.g. '2025-06-16T09:00:00' */
  dateTime: string;
  patientEmail: string;
  patientFirstName: string;
  /** Set by doctor when creating the appointment */
  appointmentType?: AppointmentType;
  durationMinutes?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  View-model types used by the timetable components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents one time-slot cell in the timetable grid.
 */
export interface TimetableSlot {
  /** ISO datetime string — unique key for this slot */
  dateTime: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'HH:mm' */
  time: string;
  /**
   * 'available'  — doctor works this slot, no booking yet
   * 'pending'    — a PENDING appointment exists
   * 'confirmed'  — slot is locked (CONFIRMED appointment)
   * 'completed'  — past completed appointment
   * 'blocked'    — outside doctor's working hours for that day
   * 'cancelled'  — slot was cancelled (shows as available again in patient view)
   */
  state: 'available' | 'pending' | 'confirmed' | 'completed' | 'blocked' | 'cancelled';
  /** Appointment linked to this slot (doctor view only) */
  appointment?: AppointmentResponse;
}

/**
 * One column in the timetable = one calendar day.
 */
export interface TimetableDay {
  /** 'YYYY-MM-DD' */
  date: string;
  /** Human-readable: 'Lun 16 juin' */
  label: string;
  dayOfWeek: DayOfWeek;
  /** True if doctor has a working schedule for this day */
  isWorkDay: boolean;
  slots: TimetableSlot[];
}

/** Describes the view window */
export type TimetableRange = '1week' | '1month' | '3months';

// ─────────────────────────────────────────────────────────────────────────────
//  Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AvailabilityTimetableService {

  private readonly http = inject(HttpClient);

  // ── Base URLs ──────────────────────────────────────────────────────────────

  private doctorAvailabilityUrl(doctorId: string): string {
    return `http://localhost:8080/api/v1/doctors/${doctorId}/availability`;
  }

  private readonly appointmentsUrl = 'http://localhost:8080/api/v1/appointments';
  // ── Availability CRUD ──────────────────────────────────────────────────────

  /**
   * Upsert (create or replace) the availability for a specific day.
   * Backend: POST /api/v1/doctors/{doctorId}/availability
   */
  setAvailability(doctorId: string, request: DoctorAvailabilityRequest): Observable<DoctorAvailabilityResponse> {
    return this.http.post<DoctorAvailabilityResponse>(
      this.doctorAvailabilityUrl(doctorId),
      request
    );
  }

  /**
   * Fetch all availability entries for a doctor (all days they work).
   * Backend: GET /api/v1/doctors/{doctorId}/availability
   */
  getAvailability(doctorId: string): Observable<DoctorAvailabilityResponse[]> {
    return this.http.get<DoctorAvailabilityResponse[]>(
      this.doctorAvailabilityUrl(doctorId)
    );
  }

  /**
   * Remove a doctor's availability for one specific day of week.
   * Backend: DELETE /api/v1/doctors/{doctorId}/availability/day?day=MONDAY
   */
  deleteAvailability(doctorId: string, day: DayOfWeek): Observable<void> {
    const params = new HttpParams().set('day', day);
    return this.http.delete<void>(
      `${this.doctorAvailabilityUrl(doctorId)}/day`,
      { params }
    );
  }

  // ── Available slots ────────────────────────────────────────────────────────

  /**
   * Fetch available (not-yet-confirmed) slots for one specific date.
   * Backend: GET /api/v1/appointments/available-slots?doctorId=X&date=YYYY-MM-DD
   */
  getAvailableSlots(doctorId: string, date: string): Observable<AvailableSlotsResponse> {
    const params = new HttpParams()
      .set('doctorId', doctorId)
      .set('date', date);
    return this.http.get<AvailableSlotsResponse>(
      `${this.appointmentsUrl}/available-slots`,
      { params }
    );
  }

  // ── Appointments ──────────────────────────────────────────────────────────

  /**
   * Create a new appointment (patient books a slot).
   * Backend: POST /api/v1/appointments
   */
  createAppointment(request: AppointmentRequest): Observable<AppointmentResponse> {
    return this.http.post<AppointmentResponse>(this.appointmentsUrl, request);
  }

  /**
   * Confirm an appointment (doctor action).
   * Backend: PATCH /api/v1/appointments/{id}/confirm
   */
  confirmAppointment(id: string, request: AppointmentRequest): Observable<AppointmentResponse> {
    return this.http.patch<AppointmentResponse>(
      `${this.appointmentsUrl}/${id}/confirm`,
      request
    );
  }

  /**
   * Cancel an appointment.
   * Backend: PATCH /api/v1/appointments/{id}/cancel
   */
  cancelAppointment(id: string, request: AppointmentRequest): Observable<AppointmentResponse> {
    return this.http.patch<AppointmentResponse>(
      `${this.appointmentsUrl}/${id}/cancel`,
      request
    );
  }

  /**
   * Reschedule an existing appointment.
   * Backend: PUT /api/v1/appointments/{id}/reschedule
   */
  rescheduleAppointment(id: string, request: AppointmentRequest): Observable<AppointmentResponse> {
    return this.http.put<AppointmentResponse>(
      `${this.appointmentsUrl}/${id}/reschedule`,
      request
    );
  }

  // ── Timetable builder ─────────────────────────────────────────────────────

  /**
   * Builds the complete timetable view model for a date window.
   *
   * Strategy:
   * 1. Fetch the doctor's weekly availability (which days + hours).
   * 2. Fetch all existing appointments (doctor view) or available slots per day (patient view).
   * 3. Generate every possible slot for every day in the window.
   * 4. Colour each slot based on appointment status.
   *
   * @param doctorId     UUID of the doctor
   * @param startDate    First date of the window
   * @param range        '1week' | '1month' | '3months'
   * @param appointments Pre-fetched appointments array (doctor has them; for patient we pass [])
   * @param doctorViewMode  true = show appointment details; false = patient view (no patient data)
   */
  buildTimetable(
    doctorId: string,
    startDate: Date,
    range: TimetableRange,
    appointments: AppointmentResponse[],
    doctorViewMode: boolean
  ): Observable<TimetableDay[]> {

    const dates = this.generateDateWindow(startDate, range);

    return this.getAvailability(doctorId).pipe(
      map(availabilities => {
        const availMap = new Map<DayOfWeek, DoctorAvailabilityResponse>(
          availabilities.map(a => [a.dayOfWeek, a])
        );

        return dates.map(date => this.buildDay(date, availMap, appointments, doctorViewMode));
      })
    );
  }

  /**
   * Patient view: fetches available slots from the backend for each date in
   * the window and merges with availability to build the timetable.
   * Patient never sees other patients' data — only slot colours.
   */
  buildPatientTimetable(
    doctorId: string,
    startDate: Date,
    range: TimetableRange
  ): Observable<TimetableDay[]> {
    const dates = this.generateDateWindow(startDate, range);

    return this.getAvailability(doctorId).pipe(
      switchMap(availabilities => {
        const availMap = new Map<DayOfWeek, DoctorAvailabilityResponse>(
          availabilities.map(a => [a.dayOfWeek, a])
        );

        // Fetch available slots for each work-day in the window
        const workDays = dates.filter(d => {
          const dow = this.toDayOfWeek(d);
          return availMap.has(dow);
        });

        if (workDays.length === 0) {
          return of(dates.map(date =>
            this.buildDay(date, availMap, [], false)
          ));
        }

        const slotRequests = workDays.map(d =>
          this.getAvailableSlots(doctorId, this.toDateStr(d))
        );

        return forkJoin(slotRequests).pipe(
          map(slotResponses => {
            // Build a set of available slot ISO strings
            const availableSet = new Set<string>(
              slotResponses.flatMap(r => r.slots)
            );

            return dates.map(date => {
              const dow = this.toDayOfWeek(date);
              const avail = availMap.get(dow);

              if (!avail) {
                return {
                  date: this.toDateStr(date),
                  label: this.formatDayLabel(date),
                  dayOfWeek: dow,
                  isWorkDay: false,
                  slots: []
                } as TimetableDay;
              }

              const allSlots = this.generateSlots(date, avail);

              const slots: TimetableSlot[] = allSlots.map(slotDt => {
                const isAvailable = availableSet.has(slotDt);
                return {
                  dateTime: slotDt,
                  date: this.toDateStr(date),
                  time: slotDt.substring(11, 16),
                  // If not in available set → it's booked/confirmed (show as blocked for patient)
                  state: isAvailable ? 'available' : 'confirmed',
                  appointment: undefined // never exposed to patient
                };
              });

              return {
                date: this.toDateStr(date),
                label: this.formatDayLabel(date),
                dayOfWeek: dow,
                isWorkDay: true,
                slots
              } as TimetableDay;
            });
          })
        );
      })
    );
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private buildDay(
    date: Date,
    availMap: Map<DayOfWeek, DoctorAvailabilityResponse>,
    appointments: AppointmentResponse[],
    doctorViewMode: boolean
  ): TimetableDay {
    const dow = this.toDayOfWeek(date);
    const avail = availMap.get(dow);
    const dateStr = this.toDateStr(date);

    if (!avail) {
      return {
        date: dateStr,
        label: this.formatDayLabel(date),
        dayOfWeek: dow,
        isWorkDay: false,
        slots: []
      };
    }

    const allSlotDateTimes = this.generateSlots(date, avail);

    // Index appointments by their ISO dateTime
    const apptByDateTime = new Map<string, AppointmentResponse>();
    appointments
      .filter(a => a.dateTime.startsWith(dateStr))
      .forEach(a => {
        // Normalize to 'YYYY-MM-DDTHH:mm:00' for reliable matching
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
          case 'CANCELLED':   state = 'available';  break; // treat as free again
          case 'RESCHEDULED': state = 'pending';    break;
        }
      }

      return {
        dateTime: slotDt,
        date: dateStr,
        time: slotDt.substring(11, 16),
        state,
        appointment: doctorViewMode ? appt : undefined
      };
    });

    return {
      date: dateStr,
      label: this.formatDayLabel(date),
      dayOfWeek: dow,
      isWorkDay: true,
      slots
    };
  }

  /**
   * Generates all slot ISO datetime strings for a given day and availability.
   * e.g. ['2025-06-16T08:00:00', '2025-06-16T08:30:00', ...]
   */
  private generateSlots(date: Date, avail: DoctorAvailabilityResponse): string[] {
    const slots: string[] = [];
    const dateStr = this.toDateStr(date);

    const [startH, startM] = avail.startTime.split(':').map(Number);
    const [endH, endM]     = avail.endTime.split(':').map(Number);

    let h = startH, m = startM;
    const endTotalMin = endH * 60 + endM;

    const slotDur = avail.slotDurationMinutes ?? 30;
    while (h * 60 + m < endTotalMin) {
      const hStr = String(h).padStart(2, '0');
      const mStr = String(m).padStart(2, '0');
      slots.push(`${dateStr}T${hStr}:${mStr}:00`);

      m += slotDur;
      h += Math.floor(m / 60);
      m = m % 60;
    }

    return slots;
  }

  /**
   * Generates an array of Date objects for the given range starting from startDate.
   */
  generateDateWindow(startDate: Date, range: TimetableRange): Date[] {
    const dates: Date[] = [];
    const days = range === '1week' ? 7 : range === '1month' ? 30 : 90;

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  }

  /** Returns the ISO 'YYYY-MM-DD' string for a Date */
  toDateStr(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Maps a JS Date to DayOfWeek enum value */
  toDayOfWeek(date: Date): DayOfWeek {
    const days: DayOfWeek[] = [
      'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY',
      'THURSDAY', 'FRIDAY', 'SATURDAY'
    ];
    return days[date.getDay()];
  }

  /** French day label e.g. 'Lun 16 juin' */
  formatDayLabel(date: Date): string {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  }

  /** Week number in year (ISO-ish) */
  getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
}