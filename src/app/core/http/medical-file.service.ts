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

  getByPatientId(patientId: string): Observable<MedicalFile> {
    return this.http.get<MedicalFile>(`/api/v1/medicalfiles/patient/${patientId}`);
  }

  saveConsultation(request: ConsultationSaveRequest): Observable<Consultation> {
    return this.http.post<Consultation>('/api/v1/consultations', request);
  }
}