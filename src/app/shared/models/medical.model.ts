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
  patientId: string;
  doctorId: string;
  dateTime: string;
  status?: AppointmentStatus;
  patientEmail?: string;
  patientFirstName?: string;
  patientLastName?: string;
  appointmentType?: 'CHECKUP' | 'SURGERY' | 'FOLLOW_UP' | 'CONSULTATION';
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
  createdAt?: string;
  updatedAt?: string;
  consultations: Consultation[];
  notes?: MedicalNote[];
  riskLevel?: 'low' | 'medium' | 'high';
  riskPercentage?: number;
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
  sex: boolean;
  chestPainType: number;
  restingBloodPressure: number;
  cholesterol: number;
  fastingBloodSugar: boolean;
  restingECG: number;
  maxHeartRateAchieved: number;
  exerciseInducedAngina: boolean;
  STDepressionInducedByExercise: number;
  slopeOfPeakExerciseSTSegment: number;
  nbOfMajorVessels: number;
  thalassemia: number;
}

export interface PredictionResult {
  prediction: number;
  probability?: number;
  riskLabel?: string;
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
