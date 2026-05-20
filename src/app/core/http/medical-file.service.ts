import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  MedicalFile,
  MedicalFileUpdateRequest,
  Consultation,
  ConsultationSaveRequest,
} from '../../shared/models/medical.model';

/**
 * MedicalFileService — HTTP wrapper for the medical-file microservice.
 * Relative URLs — proxy.conf.json forwards /api/** → gateway :8080.
 */
@Injectable({ providedIn: 'root' })
export class MedicalFileService {
  private readonly http = inject(HttpClient);
  private readonly base = 'http://localhost:8080/api/v1';

  /** GET /api/v1/medicalfiles/patient/{patientId} */
  getByPatientId(patientId: string): Observable<MedicalFile> {
    return this.http.get<MedicalFile>(
      `${this.base}/medicalfiles/patient/${patientId}`
    );
  }

  /**
   * PUT /api/v1/medicalfiles/patient/{patientId}
   * Allows updating riskLevel and riskPercentage (doctor action).
   */
  updateMedicalFile(
    patientId: string,
    request: MedicalFileUpdateRequest,
  ): Observable<MedicalFile> {
    return this.http.put<MedicalFile>(
      `${this.base}/medicalfiles/patient/${patientId}`,
      request,
    );
  }

  /**
   * POST /api/v1/consultations
   * Doctor saves clinical notes/diagnosis after completing a consultation.
   * The consultation shell is created automatically by Kafka when an appointment
   * is marked COMPLETED — the doctor just updates it via PUT /consultations/{id}.
   */
  saveConsultation(request: ConsultationSaveRequest): Observable<Consultation> {
    return this.http.post<Consultation>(
      `${this.base}/consultations`,
      request,
    );
  }

  /**
   * PUT /api/v1/consultations/{id}
   * Update an existing consultation with doctor notes / diagnosis.
   */
  updateConsultation(
    consultationId: string,
    request: ConsultationSaveRequest,
  ): Observable<Consultation> {
    return this.http.put<Consultation>(
      `${this.base}/consultations/${consultationId}`,
      request,
    );
  }
}