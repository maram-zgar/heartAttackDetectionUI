export type UserRole = 'ADMIN' | 'DOCTOR' | 'PATIENT';

export interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;

  // Doctor-specific
  numeroRPPS?: string;
  isActive?: boolean;
  hospital: string;

  // Patient-specific
  dateOfBirth?: string;
  gender?: string;
  doctorId?: string;
}