import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Appointment,
  AppointmentRequest,
  AvailableSlotsResponse,
} from '../../shared/models/medical.model';
import {
  DoctorAvailabilityRequest,
  DoctorAvailabilityResponse,
} from '../../shared/models/medical.model';

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8080/api/v1/appointments';

  findAll(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(this.baseUrl);
  }

  findById(id: string): Observable<Appointment> {
    return this.http.get<Appointment>(`${this.baseUrl}/${id}`);
  }

  create(request: AppointmentRequest): Observable<Appointment> {
    return this.http.post<Appointment>(this.baseUrl, request);
  }

  reschedule(id: string, request: AppointmentRequest): Observable<Appointment> {
    return this.http.put<Appointment>(`${this.baseUrl}/${id}/reschedule`, request);
  }

  confirm(id: string, request: Partial<AppointmentRequest>): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.baseUrl}/${id}/confirm`, request);
  }

  cancel(id: string, request: Partial<AppointmentRequest>): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.baseUrl}/${id}/cancel`, request);
  }

  complete(id: string, request: Partial<AppointmentRequest>): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.baseUrl}/${id}/complete`, request);
  }

  getAvailableSlots(doctorId: string, date: string): Observable<AvailableSlotsResponse> {
    const params = new HttpParams().set('doctorId', doctorId).set('date', date);
    return this.http.get<AvailableSlotsResponse>(`${this.baseUrl}/available-slots`, { params });
  }

  getDoctorAvailability(doctorId: string): Observable<DoctorAvailabilityResponse[]> {
    return this.http.get<DoctorAvailabilityResponse[]>(`/api/v1/doctors/${doctorId}/availability`);
  }

  setDoctorAvailability(
    doctorId: string,
    request: DoctorAvailabilityRequest,
  ): Observable<DoctorAvailabilityResponse> {
    return this.http.post<DoctorAvailabilityResponse>(
      `/api/v1/doctors/${doctorId}/availability`,
      request,
    );
  }

  deleteDoctorAvailability(doctorId: string, day: string): Observable<void> {
    const params = new HttpParams().set('day', day);

    return this.http.delete<void>(`/api/v1/doctors/${doctorId}/availability`, { params });
  }
}
