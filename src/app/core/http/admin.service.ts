import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Import types from component
export interface Doctor {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  createdAt?: string;
  active?: boolean;
}

export interface AppStats {
  totalDoctors: number;
  totalPatients: number;
  totalConsultations: number;
  activeToday: number;
}

export interface ActivityEntry {
  id: number;
  type: 'doctor_created' | 'patient_registered' | 'consultation_completed' | 'account_deactivated' | string;
  description: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly baseUrl = '/admin';

  constructor(private readonly http: HttpClient) {}

  getStats(): Observable<AppStats> {
    return this.http.get<AppStats>(`${this.baseUrl}/stats`);
  }

  getDoctors(): Observable<Doctor[]> {
    return this.http.get<Doctor[]>(`${this.baseUrl}/doctors`);
  }

  getActivity(): Observable<ActivityEntry[]> {
    return this.http.get<ActivityEntry[]>(`${this.baseUrl}/activity`);
  }

  createDoctor(doctor: any): Observable<Doctor> {
    return this.http.post<Doctor>(`${this.baseUrl}/register-doctor`, doctor);
  }

  deleteDoctor(id: string | number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/doctors/${id}`);
  }
}