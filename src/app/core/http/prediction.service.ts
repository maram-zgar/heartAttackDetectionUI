import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PredictionPayload, PredictionResult } from '../../shared/models/medical.model';

@Injectable({ providedIn: 'root' })
export class PredictionService {
  private readonly http = inject(HttpClient);

  predict(payload: PredictionPayload): Observable<PredictionResult> {
    return this.http.post<PredictionResult>('http://127.0.0.1:8000/predict', payload);
  }
}