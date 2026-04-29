import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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

  // ─── All routed through Gateway (port 8080 via proxy) ──────────────────────

  // ── Auth / Profile ──────────────────────────────────────────────────────────
  getMe(): Observable<DoctorProfile> {
    return this.http.get<DoctorProfile>('/api/v1/auth/me');
  }

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

  // ── Patients  ────────────────────────────────────────────────────────────────
  // GET /api/v1/patients  → hasRole("DOCTOR") ✅
  getAllPatients(): Observable<PatientResponse[]> {
    return this.http.get<PatientResponse[]>('/api/v1/patients');
  }

  // GET /api/v1/patients/{id}  → hasRole("DOCTOR") ✅
  getPatient(patientId: string): Observable<PatientResponse> {
    return this.http.get<PatientResponse>(`/api/v1/patients/${patientId}`);
  }

  // POST /api/v1/patients → add DOCTOR role to security config
  createPatient(payload: PatientRequest): Observable<string> {
    return this.http.post<string>('/api/v1/patients', payload);
  }

  // PUT /api/v1/patients
  updatePatient(payload: PatientRequest): Observable<void> {
    return this.http.put<void>('/api/v1/patients', payload);
  }

  // DELETE /api/v1/patients/{id}
  deletePatient(patientId: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/patients/${patientId}`);
  }

  // ── Appointments ─────────────────────────────────────────────────────────────
  // GET /api/v1/appointments  → hasRole("DOCTOR") ✅
  getAllAppointments(): Observable<AppointmentResponse[]> {
    return this.http.get<AppointmentResponse[]>('/api/v1/appointments');
  }

  // GET /api/v1/appointments/{id}
  getAppointment(id: string): Observable<AppointmentResponse> {
    return this.http.get<AppointmentResponse>(`/api/v1/appointments/${id}`);
  }

  // POST /api/v1/appointments
  createAppointment(payload: AppointmentRequest): Observable<AppointmentResponse> {
    return this.http.post<AppointmentResponse>('/api/v1/appointments', payload);
  }

  // PATCH /api/v1/appointments/{id}/confirm
  confirmAppointment(id: string, payload: Partial<AppointmentRequest>): Observable<AppointmentResponse> {
    return this.http.patch<AppointmentResponse>(`/api/v1/appointments/${id}/confirm`, payload);
  }

  // PATCH /api/v1/appointments/{id}/cancel
  cancelAppointment(id: string, payload?: Partial<AppointmentRequest>): Observable<AppointmentResponse> {
    return this.http.patch<AppointmentResponse>(`/api/v1/appointments/${id}/cancel`, payload ?? {});
  }

  // PUT /api/v1/appointments/{id}/reschedule
  rescheduleAppointment(id: string, payload: AppointmentRequest): Observable<AppointmentResponse> {
    return this.http.put<AppointmentResponse>(`/api/v1/appointments/${id}/reschedule`, payload);
  }

  // GET /api/v1/appointments/available-slots?doctorId=&date=
  getAvailableSlots(doctorId: string, date: string): Observable<AvailableSlotsResponse> {
    const params = new HttpParams().set('doctorId', doctorId).set('date', date);
    return this.http.get<AvailableSlotsResponse>('/api/v1/appointments/available-slots', { params });
  }

  // ── Medical Files ─────────────────────────────────────────────────────────────
  // GET /api/v1/medicalfiles/patient/{patientId}
  getMedicalFile(patientId: string): Observable<MedicalFileResponse> {
    return this.http.get<MedicalFileResponse>(`/api/v1/medicalfiles/patient/${patientId}`);
  }

  // POST /api/v1/medicalfiles/{fileId}/vitals
  addVitals(fileId: string, payload: VitalsRequest): Observable<VitalsRecord> {
    return this.http.post<VitalsRecord>(`/api/v1/medicalfiles/${fileId}/vitals`, payload);
  }

  // POST /api/v1/medicalfiles/{fileId}/notes
  addNote(fileId: string, payload: NoteRequest): Observable<NoteRecord> {
    return this.http.post<NoteRecord>(`/api/v1/medicalfiles/${fileId}/notes`, payload);
  }

  // ── Consultation completion ───────────────────────────────────────────────────
  // POST /api/v1/doctors/complete-consultation → hasRole("DOCTOR") ✅
  completeConsultation(payload: ConsultationCompletedRequest): Observable<void> {
    return this.http.post<void>('/api/v1/doctors/complete-consultation', payload);
  }
}