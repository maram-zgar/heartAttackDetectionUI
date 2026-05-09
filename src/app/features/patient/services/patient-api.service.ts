import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PatientResponse } from '../../doctor/models/doctor.model';

@Injectable({ providedIn: 'root' })
export class PatientApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/patients';

  getPatientProfile(id: string): Observable<PatientResponse> {
    return this.http.get<PatientResponse>(`${this.baseUrl}/${id}`);
  }

  updateProfile(id: string, data: Partial<PatientResponse>): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, data);
  }

  // Add more patient-specific endpoints as needed
}