import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Appointment,
  AppointmentRequest,
  AvailableSlotsResponse,
  DoctorAvailabilityRequest,
  DoctorAvailabilityResponse,
} from '../../shared/models/medical.model';

/**
 * AppointmentService — HTTP wrapper for all appointment endpoints.
 * Uses relative URLs so the Angular proxy (proxy.conf.json) forwards
 * /api/** to the gateway on :8080, avoiding CORS completely.
 */
@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private readonly http = inject(HttpClient);
  private readonly base = 'http://localhost:8080/api/v1/appointments';

  findAll(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(this.base);
  }

  findById(id: string): Observable<Appointment> {
    return this.http.get<Appointment>(`${this.base}/${id}`);
  }

  create(request: AppointmentRequest): Observable<Appointment> {
    return this.http.post<Appointment>(this.base, request);
  }

  reschedule(id: string, request: AppointmentRequest): Observable<Appointment> {
    return this.http.put<Appointment>(`${this.base}/${id}/reschedule`, request);
  }

  confirm(id: string, request: Partial<AppointmentRequest>): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.base}/${id}/confirm`, request);
  }

  cancel(id: string, request: Partial<AppointmentRequest>): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.base}/${id}/cancel`, request);
  }

  complete(id: string, request: Partial<AppointmentRequest>): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.base}/${id}/complete`, request);
  }

  getAvailableSlots(doctorId: string, date: string): Observable<AvailableSlotsResponse> {
    const params = new HttpParams()
      .set('doctorId', doctorId)
      .set('date', date);
    return this.http.get<AvailableSlotsResponse>(`${this.base}/available-slots`, { params });
  }

  findByPatientId(patientId: string): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${this.base}/patient/${patientId}`);
  }

  // ── Doctor availability ───────────────────────────────────────────────────

  getDoctorAvailability(doctorId: string): Observable<DoctorAvailabilityResponse[]> {
    return this.http.get<DoctorAvailabilityResponse[]>(
      `http://localhost:8080/api/v1/doctors/${doctorId}/availability`
    );
  }

  setDoctorAvailability(
    doctorId: string,
    request: DoctorAvailabilityRequest,
  ): Observable<DoctorAvailabilityResponse> {
    return this.http.post<DoctorAvailabilityResponse>(
      `http://localhost:8080/api/v1/doctors/${doctorId}/availability`,
      request,
    );
  }

  deleteDoctorAvailability(doctorId: string, day: string): Observable<void> {
    const params = new HttpParams().set('day', day);
    return this.http.delete<void>(
      `http://localhost:8080/api/v1/doctors/${doctorId}/availability/day`,
      { params },
    );
  }
}