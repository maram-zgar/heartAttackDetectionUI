import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Consultation,
  ConsultationSaveRequest,
  MedicalFile,
} from '../../shared/models/medical.model';

@Injectable({ providedIn: 'root' })
export class MedicalFileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8080/api/v1';

  getByPatientId(patientId: string): Observable<MedicalFile> {
    return this.http.get<MedicalFile>(`${this.baseUrl}/medicalfiles/patient/${patientId}`);
  }

  saveConsultation(request: ConsultationSaveRequest): Observable<Consultation> {
    return this.http.post<Consultation>(`${this.baseUrl}/consultations`, request);
  }
}
