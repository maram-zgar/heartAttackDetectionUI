import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';

export interface PatientProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  age?: number;
  dateOfBirth?: string;
  gender?: string;
  doctorId?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class PatientService {
  private readonly http       = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly baseUrl    = 'http://localhost:8080/api/v1';

  private getAuthHeaders(): { headers: HttpHeaders } {
    const token = isPlatformBrowser(this.platformId)
      ? localStorage.getItem('access_token') : null;
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` }) };
  }

  getProfile(id: string): Observable<PatientProfile> {
    return this.http.get<PatientProfile>(`${this.baseUrl}/patients/${id}`, this.getAuthHeaders());
  }

  updateProfile(id: string, data: Partial<PatientProfile>): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/patients/${id}`, data, this.getAuthHeaders());
  }

  changePassword(data: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/change-password`, data, this.getAuthHeaders());
  }

  getAssignedDoctor(doctorId: string): Observable<{ firstName: string; lastName: string }> {
    return this.http.get<{ firstName: string; lastName: string }>(
      `${this.baseUrl}/doctors/${doctorId}`, this.getAuthHeaders()
    );
  }
}