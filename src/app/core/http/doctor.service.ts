import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { selectCurrentUser } from '../../store/auth/auth.selectors';

export interface Patient {
  id: string | number;
  firstName: string;
  lastName: string;
  email: string;
  age: number;
  dateOfBirth?: string;
  lastVisit?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface Appointment {
  dateTime: any;
  id: string;
  patientId: string;
  doctorId: string;
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
}

export interface ChangePasswordRequest {
  email: string;
  currentPassword: string;
  newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class DoctorService {
  private http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly baseUrl = '/api/v1';

  getPatients(doctorId: string): Observable<Patient[]> {
    return this.http.get<Patient[]>(`${this.baseUrl}/patients/doctor/${doctorId}`);
  }

  createPatient(data: Partial<Patient>): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/patients`, data);
  }

  getPatientById(id: number): Observable<Patient> {
    return this.http.get<Patient>(`${this.baseUrl}/patients/${id}`);
  }
  
  deletePatient(id: string | number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/patients/${id}`);
  }

  updatePatient(id: string | number, data: Partial<Patient>): Observable<Patient> {
    return this.http.put<Patient>(`${this.baseUrl}/patients/${id}`, data);
  }

  getAppointments(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${this.baseUrl}/appointments`);
  }

  completeConsultation(data: ConsultationComplete): Observable<any> {
    return this.http.post(`${this.baseUrl}/doctors/consultation-complete`, data);
  }

  changePassword(data: ChangePasswordRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/doctors/change-password`, {...data});
  }

  getDoctorById(id: string): Observable<{ firstName: string; lastName: string }> {
    return this.http.get<{ firstName: string; lastName: string }>(`${this.baseUrl}/doctors/${id}`);
  }

  getAllDoctors(): Observable<{ id: string; firstName: string; lastName: string }[]> {
    return this.http.get<{ id: string; firstName: string; lastName: string }[]>(`${this.baseUrl}/doctors`);
  }

  updateDoctor(data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/doctors`, data);
  }

}
