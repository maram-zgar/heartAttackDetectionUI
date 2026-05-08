import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  PatientResponse, PatientRequest,
  AppointmentResponse, AppointmentRequest,
  MedicalFileResponse, VitalsRequest, VitalsRecord,
  NoteRequest, NoteRecord, PredictionResponse,
  AvailableSlotsResponse, ChangePasswordRequest,
  DoctorProfile, ConsultationCompletedRequest
} from '../models/doctor.model';

@Injectable({ providedIn: 'root' })
export class DoctorApiService {
  private http = inject(HttpClient);

  private getAuthHeaders(): { headers: HttpHeaders } {
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return { headers };
  }

  // ── Auth / Profile ──────────────────────────────────────────────────────────

  changePassword(payload: ChangePasswordRequest): Observable<void> {
    return this.http.patch<void>('/api/v1/auth/change-password', payload);
  }

  updateDoctorProfile(payload: Partial<DoctorProfile>): Observable<void> {
    return this.http.put<void>('/api/v1/doctors/profile', payload);
  }

  uploadAvatar(file: File): Observable<{ avatarUrl: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ avatarUrl: string }>('/api/v1/doctors/profile/avatar', form);
  }

  // ── Patients ─────────────────────────────────────────────────────────────────

  getAllPatients(): Observable<PatientResponse[]> {
    return this.http.get<PatientResponse[]>('/api/v1/patients');
  }

  getPatient(patientId: string): Observable<PatientResponse> {
    return this.http.get<PatientResponse>(`/api/v1/patients/${patientId}`);
  }

  createPatient(payload: PatientRequest): Observable<PatientResponse> {
    return this.http.post<PatientResponse>('/api/v1/patients', payload);
  }

  updatePatient(payload: PatientRequest): Observable<void> {
    return this.http.put<void>('/api/v1/patients', payload);
  }

  deletePatient(patientId: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/patients/${patientId}`);
  }

  // ── Appointments ─────────────────────────────────────────────────────────────

  getAllAppointments(): Observable<AppointmentResponse[]> {
    return this.http.get<AppointmentResponse[]>('/api/v1/appointments');
  }

  getAppointment(id: string): Observable<AppointmentResponse> {
    return this.http.get<AppointmentResponse>(`/api/v1/appointments/${id}`);
  }

  createAppointment(payload: AppointmentRequest): Observable<AppointmentResponse> {
    return this.http.post<AppointmentResponse>('/api/v1/appointments', payload);
  }

  confirmAppointment(id: string, payload: Partial<AppointmentRequest>): Observable<AppointmentResponse> {
    return this.http.patch<AppointmentResponse>(`/api/v1/appointments/${id}/confirm`, payload);
  }

  cancelAppointment(id: string, payload?: Partial<AppointmentRequest>): Observable<AppointmentResponse> {
    return this.http.patch<AppointmentResponse>(`/api/v1/appointments/${id}/cancel`, payload ?? {});
  }

  rescheduleAppointment(id: string, payload: AppointmentRequest): Observable<AppointmentResponse> {
    return this.http.put<AppointmentResponse>(`/api/v1/appointments/${id}/reschedule`, payload);
  }

  getAvailableSlots(doctorId: string, date: string): Observable<AvailableSlotsResponse> {
    const params = new HttpParams().set('doctorId', doctorId).set('date', date);
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    return this.http.get<AvailableSlotsResponse>('/api/v1/appointments/available-slots', { headers, params });
  }

  // ── Medical Files ─────────────────────────────────────────────────────────────

  getMedicalFile(patientId: string): Observable<MedicalFileResponse> {
    return this.http.get<MedicalFileResponse>(`/api/v1/medicalfiles/patient/${patientId}`);
  }

  addVitals(fileId: string, payload: VitalsRequest): Observable<VitalsRecord> {
    return this.http.post<VitalsRecord>(`/api/v1/medicalfiles/${fileId}/vitals`, payload);
  }

  addNote(fileId: string, payload: NoteRequest): Observable<NoteRecord> {
    return this.http.post<NoteRecord>(`/api/v1/medicalfiles/${fileId}/notes`, payload);
  }

  // ── Consultation ─────────────────────────────────────────────────────────────

  completeConsultation(payload: ConsultationCompletedRequest): Observable<void> {
    return this.http.post<void>('/api/v1/doctors/complete-consultation', payload);
  }
}