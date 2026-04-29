import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Patient {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
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

@Injectable({ providedIn: 'root' })
export class DoctorService {
  private http = inject(HttpClient);

  // GET /api/v1/patients — requires DOCTOR role (proxied via Gateway 8080)
  getPatients(): Observable<Patient[]> {
    return this.http.get<Patient[]>('/api/v1/patients');
  }

  // GET /api/v1/patients/:id
  getPatientById(id: number): Observable<Patient> {
    return this.http.get<Patient>(`/api/v1/patients/${id}`);
  }

  // GET /api/v1/appointments — requires DOCTOR authority
  getAppointments(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>('/api/v1/appointments');
  }

  // POST /api/v1/doctors/consultation/complete — requires DOCTOR role
  completeConsultation(data: ConsultationComplete): Observable<any> {
    return this.http.post('/api/v1/doctors/consultation-complete', data);
  }
}