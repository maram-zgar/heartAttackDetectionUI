import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Vitals {
  id: string;
  recordedAt: string;
  age: number | null;
  sex: number | null;
  chestPainType: number | null;
  restingBloodPressure: number | null;
  cholesterol: number | null;
  fastingBloodSugar: number | null;
  restingECG: number | null;
  maxHeartRateAchieved: number | null;
  exerciseInducedAngina: number | null;
  slopeOfPeakExerciseSTSegment: number | null;
  nbOfMajorVessels: number | null;
  thalassemia: number | null;
  risk_percentage: number | null;
  probability: number | null;
  stdepressionInducedByExercise: number | null;
}

export interface PatientConsultation {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  dateDeConsultation: string;
  notes: string | null;
  vitals: Vitals[];
}

@Injectable({ providedIn: 'root' })
export class ConsultationService {
  private readonly http = inject(HttpClient);
  private readonly base = 'http://localhost:8080/api/v1';

  getByPatientId(patientId: string): Observable<PatientConsultation[]> {
    return this.http.get<PatientConsultation[]>(
      `${this.base}/consultations/by-patient/${patientId}`
    );
  }
}
