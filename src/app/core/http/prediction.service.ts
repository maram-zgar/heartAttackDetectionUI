import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PredictionPayload, PredictionResult } from '../../shared/models/medical.model';

@Injectable({ providedIn: 'root' })
export class PredictionService {
  private readonly http = inject(HttpClient);

  predict(payload: PredictionPayload): Observable<PredictionResult> {
    return this.http.post<PredictionResult>('/api/v1/prediction/predict', payload);
  }
}