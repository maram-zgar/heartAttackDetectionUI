import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';

// Import types from component
export interface Doctor {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  numeroRPPS?: string;
  avatarUrl?: string;
  hospital?: string;
  role?: string;
  createdAt?: string;
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

  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private getAuthHeaders(): { headers: HttpHeaders } {
    const token = this.isBrowser ? localStorage.getItem('access_token') : null;

    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token ?? ''}`
      })
    };
  }


  getStats(): Observable<AppStats> {
    return this.http.get<AppStats>(`${this.baseUrl}/stats`, this.getAuthHeaders());
  }

  getDoctors(): Observable<Doctor[]> {
    return this.http.get<Doctor[]>(`${this.baseUrl}/doctors`, this.getAuthHeaders());
  }

  getActivity(): Observable<ActivityEntry[]> {
    return this.http.get<ActivityEntry[]>(`${this.baseUrl}/activity`, this.getAuthHeaders());
  }

  createDoctor(doctor: any): Observable<Doctor> {
    return this.http.post<Doctor>(`${this.baseUrl}/register-doctor`, doctor, this.getAuthHeaders());
  }

  deleteDoctor(id: string | number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/doctors/${id}`, this.getAuthHeaders());
  }
}