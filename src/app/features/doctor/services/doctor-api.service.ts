import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  PatientResponse,
  PatientRequest,
  AppointmentResponse,
  AppointmentRequest,
  MedicalFileResponse,
  VitalsRequest,
  VitalsRecord,
  NoteRequest,
  NoteRecord,
  PredictionResponse,
  AvailableSlotsResponse,
  ChangePasswordRequest,
  DoctorProfile,
  ConsultationCompletedRequest,
} from '../models/doctor.model';

@Injectable({ providedIn: 'root' })
export class DoctorApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8080/api/v1';

  private getAuthHeaders(): { headers: HttpHeaders } {
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    return { headers };
  }

  // ── Auth / Profile ──────────────────────────────────────────────────────────

  changePassword(payload: ChangePasswordRequest): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/auth/change-password`, payload);
  }

  updateDoctorProfile(payload: Partial<DoctorProfile>): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/doctors/profile`, payload);
  }

  uploadAvatar(file: File): Observable<{ avatarUrl: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ avatarUrl: string }>(`${this.baseUrl}/doctors/profile/avatar`, form);
  }

  // ── Patients ─────────────────────────────────────────────────────────────────

  getAllPatients(doctorId: string): Observable<PatientResponse[]> {
    return this.http.get<PatientResponse[]>(`${this.baseUrl}/patients/doctor/${doctorId}`);
  }

  getPatient(patientId: string): Observable<PatientResponse> {
    return this.http.get<PatientResponse>(`${this.baseUrl}/patients/${patientId}`);
  }

  createPatient(payload: PatientRequest): Observable<PatientResponse> {
    return this.http.post<PatientResponse>(`${this.baseUrl}/auth/register`, payload);
  }

  updatePatient(payload: PatientRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/patients`, payload);
  }

  deletePatient(patientId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/patients/${patientId}`);
  }

  // ── Appointments ─────────────────────────────────────────────────────────────

  getAllAppointments(): Observable<AppointmentResponse[]> {
    return this.http.get<AppointmentResponse[]>(`${this.baseUrl}/appointments`);
  }

  getAppointment(id: string): Observable<AppointmentResponse> {
    return this.http.get<AppointmentResponse>(`${this.baseUrl}/appointments/${id}`);
  }

  createAppointment(payload: AppointmentRequest): Observable<AppointmentResponse> {
    return this.http.post<AppointmentResponse>(`${this.baseUrl}/appointments`, payload);
  }

  confirmAppointment(
    id: string,
    payload: Partial<AppointmentRequest>,
  ): Observable<AppointmentResponse> {
    return this.http.patch<AppointmentResponse>(
      `${this.baseUrl}/appointments/${id}/confirm`,
      payload,
    );
  }

  cancelAppointment(
    id: string,
    payload?: Partial<AppointmentRequest>,
  ): Observable<AppointmentResponse> {
    return this.http.patch<AppointmentResponse>(
      `${this.baseUrl}/appointments/${id}/cancel`,
      payload ?? {},
    );
  }

  rescheduleAppointment(id: string, payload: AppointmentRequest): Observable<AppointmentResponse> {
    return this.http.put<AppointmentResponse>(
      `${this.baseUrl}/appointments/${id}/reschedule`,
      payload,
    );
  }

  getAvailableSlots(doctorId: string, date: string): Observable<AvailableSlotsResponse> {
    const params = new HttpParams().set('doctorId', doctorId).set('date', date);
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.get<AvailableSlotsResponse>(`${this.baseUrl}/appointments/available-slots`, {
      headers,
      params,
    });
  }

  // ── Medical Files ─────────────────────────────────────────────────────────────

  getMedicalFile(patientId: string): Observable<MedicalFileResponse> {
    return this.http.get<MedicalFileResponse>(`${this.baseUrl}/medicalfiles/patient/${patientId}`);
  }

  addVitals(fileId: string, payload: VitalsRequest): Observable<VitalsRecord> {
    return this.http.post<VitalsRecord>(`${this.baseUrl}/medicalfiles/${fileId}/vitals`, payload);
  }

  addNote(fileId: string, payload: NoteRequest): Observable<NoteRecord> {
    return this.http.post<NoteRecord>(`${this.baseUrl}/medicalfiles/${fileId}/notes`, payload);
  }

  // ── Consultation ─────────────────────────────────────────────────────────────

  completeConsultation(payload: ConsultationCompletedRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/doctors/complete-consultation`, payload);
  }
}
