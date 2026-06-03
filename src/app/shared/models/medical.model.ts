export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'RESCHEDULED' | 'CANCELLED' | 'COMPLETED';

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  dateTime: string;
  status: AppointmentStatus;
  patientEmail?: string;
  patientFirstName?: string;
  patientLastName?: string;
  doctorFirstName?: string;
  doctorLastName?: string;
  appointmentType?: 'CHECKUP' | 'SURGERY' | 'FOLLOW_UP' | 'CONSULTATION';
}

export interface AppointmentRequest {
  patientId:        string;
  doctorId:         string;
  dateTime:         string;
  patientEmail?:    string;
  patientFirstName?: string;
  patientLastName?:  string;
  status?:            AppointmentStatus;
  notes?:           string;
  diagnosis?:       string;
  appointmentType?: 'CHECKUP' | 'SURGERY' | 'FOLLOW_UP' | 'CONSULTATION';
  prediction?: number;
  riskPercentage?: number;           // mapped from risk_percentageDouble
  // Vitals matching Java model
  age?: number;
  sex?: boolean;                      // changed to number (0/1)
  chestPainType?: number;
  restingBloodPressure?: number;     // renamed from restingBP
  cholesterol?: number;
  fastingBloodSugar?: boolean;       // renamed from fastingBS
  restingECG?: number;
  maxHeartRateAchieved?: number;     // renamed from maxHR
  exerciseInducedAngina?: boolean;   // renamed from exerciseAngina
  STDepressionInducedByExercise?: number; // renamed from oldpeak
  slopeOfPeakExerciseSTSegment?: number;  // renamed from slope
  nbOfMajorVessels?: number;
  thalassemia?: number;
}

export interface AvailableSlotsResponse {
  doctorId: string;
  date: string;
  slots: string[];
}

export interface DoctorAvailability {
  id?: string;
  doctorId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export interface PatientSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth?: string;
  phone?: string;
  gender?: string;
  doctorId?: string;
  status?: 'stable' | 'critical' | 'monitoring' | 'discharged';
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface MedicalFile {
  id: string;
  patientId: string;
  patientFirstName?: string;
  patientLastName?: string;
  creationDate?: string;
  lastUpdateDate?: string;
  consultations: Consultation[];
  notes?: MedicalNote[];
  riskLevel?: 'low' | 'medium' | 'high';
  riskPercentage?: number;
  vitals: Vitals[];
}

export interface MedicalFileUpdateRequest {
  riskLevel?: 'low' | 'medium' | 'high';
  riskPercentage?: number;
}

export interface Consultation {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  dateDeConsultation: string;
  doctorFirstName?: string;
  doctorLastName?: string;
  notes?: string;
  diagnosis?: string;
  predictionResult?: PredictionResult;
  visibleToPatient?: boolean;
}

export interface ConsultationSaveRequest {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  notes: string;
  diagnosis?: string;
  predictionResult?: PredictionResult;
}

export interface MedicalNote {
  id: string;
  createdAt: string;
  content: string;
  authorId?: string;
  authorName?: string;
}

export interface PredictionPayload {
  age: number;
  sex: boolean;                              // changed to number
  chestPainType: number;
  restingBloodPressure: number;             // renamed
  cholesterol: number;
  fastingBloodSugar: boolean;               // renamed
  restingECG: number;
  maxHeartRateAchieved: number;             // renamed
  exerciseInducedAngina: boolean;           // renamed
  STDepressionInducedByExercise: number;    // renamed from oldpeak
  slopeOfPeakExerciseSTSegment: number;     // renamed from slope
  nbOfMajorVessels: number;
  thalassemia: number;
}

export interface PredictionResult {
  percentage: string;
  prediction:  'High Risk' | 'Low Risk';
  risk_percentage?: number;
  createdAt?: string;
  payload?: PredictionPayload;
}  

export interface DoctorAvailabilityRequest {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

export interface DoctorAvailabilityResponse {
  id?: string;
  doctorId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

// shared/models/medical.model.ts

export interface Vitals {
  id: string;
  recordedAt: string;
  age?: number;
  sex?: number;                              // changed to number
  chestPainType?: number;
  restingBloodPressure?: number;             // renamed
  cholesterol?: number;
  fastingBloodSugar?: boolean;               // renamed
  restingECG?: number;
  maxHeartRateAchieved?: number;             // renamed
  exerciseInducedAngina?: boolean;           // renamed
  STDepressionInducedByExercise?: number;    // renamed from oldpeak
  slopeOfPeakExerciseSTSegment?: number;     // renamed from slope
  nbOfMajorVessels?: number;
  thalassemia?: number;
  prediction?: number;
  probability?: number;
  riskPercentageDouble?: number;
}
