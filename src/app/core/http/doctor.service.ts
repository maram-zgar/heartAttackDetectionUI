import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';

export interface Patient {
  id: string | number;
  firstName: string;
  lastName: string;
  email: string;
  hospital: string;
  age: number;
  dateOfBirth?: string;
  phone?: string;
  status?: 'stable' | 'critical' | 'monitoring' | 'discharged';
  lastVisit?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface Appointment {
  id: number;
  patientId: number;
  patientName?: string;
  date: string;
  time?: string;
  type?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}

export interface ConsultationComplete {
  appointmentId: number;
  notes: string;
  diagnosis?: string;
  nextAppointment?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class DoctorService {
  private http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private getAuthHeaders(): { headers: HttpHeaders } {
    const token = this.isBrowser ? localStorage.getItem('access_token') : null;
    return {
      headers: new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` })
    };
  }

  getPatients(): Observable<Patient[]> {
    return this.http.get<Patient[]>('/api/v1/patients', this.getAuthHeaders());
  }

  createPatient(data: Partial<Patient>): Observable<Patient> {
    return this.http.post<Patient>('/api/v1/patients', data, this.getAuthHeaders());
  }

  getPatientById(id: number): Observable<Patient> {
    return this.http.get<Patient>(`/api/v1/patients/${id}`, this.getAuthHeaders());
  }

  getAppointments(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>('/api/v1/appointments', this.getAuthHeaders());
  }

  completeConsultation(data: ConsultationComplete): Observable<any> {
    return this.http.post('/api/v1/doctors/consultation-complete', data, this.getAuthHeaders());
  }

  changePassword(data: ChangePasswordRequest): Observable<any> {
    return this.http.post('/api/v1/doctors/change-password', data, this.getAuthHeaders());
  }

  updateDoctor(data: any): Observable<any> {
    return this.http.put('/api/v1/doctors', data, this.getAuthHeaders());
  }

  deletePatient(id: string | number): Observable<any> {
    return this.http.delete(`/api/v1/patients/${id}`, this.getAuthHeaders());
  }

  updatePatient(id: string | number, data: Partial<Patient>): Observable<Patient> {
    return this.http.put<Patient>(`/api/v1/patients/${id}`, data, this.getAuthHeaders());
  }
}