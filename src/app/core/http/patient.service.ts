import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PatientProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  age?: number;
  dateOfBirth?: string;
  gender?: string;
  /** UUID of the doctor assigned to this patient (may be absent) */
  doctorId?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * PatientService — HTTP wrapper for patient-facing profile endpoints.
 * Relative URLs so the Angular proxy forwards /api/** to the gateway on :8080.
 * Auth header is injected automatically by auth.interceptor.ts — no manual
 * header construction needed here.
 */
@Injectable({ providedIn: 'root' })
export class PatientService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1';

  getProfile(id: string): Observable<PatientProfile> {
    return this.http.get<PatientProfile>(`${this.base}/patients/${id}`);
  }

  updateProfile(id: string, data: Partial<PatientProfile>): Observable<void> {
    return this.http.put<void>(`${this.base}/patients/${id}`, data);
  }

  /** Uses the shared gateway auth endpoint — same for doctors and patients. */
  changePassword(data: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/change-password`, data);
  }

  getAssignedDoctor(doctorId: string): Observable<{ firstName: string; lastName: string }> {
    return this.http.get<{ firstName: string; lastName: string }>(
      `${this.base}/doctors/${doctorId}`
    );
  }
}