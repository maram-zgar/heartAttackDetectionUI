import { UserProfile } from '../../../shared/models/user-profile.model';

export type DoctorProfile = UserProfile & {
  role: 'DOCTOR';
  numeroRPPS?: string;
  isActive: boolean;
};

export interface PatientResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth?: string;
  gender?: string;
  doctorId?: string;
}

export interface PatientRequest {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth?: string;
  gender?: string;
}

export interface AppointmentResponse {
  id: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  patientEmail: string;
  doctorId: string;
  doctorFirstName: string;
  doctorLastName: string;
  scheduledAt: string;
  duration: number;
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
}

export type AppointmentStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'COMPLETED';

export interface AppointmentRequest {
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  duration: number;
}

export interface MedicalFileResponse {
  id: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  createdAt: string;
  updatedAt: string;
  consultations: ConsultationRecord[];
  vitals: VitalsRecord[];
  notes: NoteRecord[];
}

export interface ConsultationRecord {
  id: string;
  appointmentId: string;
  doctorId: string;
  doctorFirstName: string;
  doctorLastName: string;
  date: string;
  notes?: string;
}

export interface VitalsRecord {
  id: string;
  recordedAt: string;
  age: number;
  gender: boolean;
  chestPain: number;
  restingbloodPressure: number;
  cholesterol: number;
  fastingBloodSugar: number;
  restingECG: number;
  thalach: number;
  exang: boolean;
  oldpeak: number;
  slope: number;
  ca: number; // Number of major vessels
  riskScore?: number;       // 0–100, from ML model
  riskLevel?: RiskLevel;
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface VitalsRequest {
  restingbloodPressure: number;
  cholesterol: number;
  fastingBloodSugar: number;
  restingECG: number;
  thalach: number;
  exang: boolean;
  oldpeak: number;
  slope: number;
  ca: number;
}

export interface NoteRecord {
  id: string;
  createdAt: string;
  content: string;
  authorId: string;
  authorName: string;
}

export interface NoteRequest {
  content: string;
}

export interface PredictionResponse {
  riskScore: number;
  riskLevel: RiskLevel;
  factors: string[];
  recommendation: string;
}

export interface AvailableSlotsResponse {
  doctorId: string;
  date: string;
  slots: string[];
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ConsultationCompletedRequest {
  appointmentId: string;
  patientId: string;
  patientEmail: string;
  patientFirstName: string;
  doctorId: string;
  doctorEmail: string;
}