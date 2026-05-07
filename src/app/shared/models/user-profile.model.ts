export type UserRole = 'ADMIN' | 'DOCTOR' | 'PATIENT';

export interface UserProfile {
  id: string;        // UUID from backend serializes as a string
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;

  // Doctor-specific
  numeroRPPS?:  string;
  phoneNumber?: string;
  avatarUrl?:   string;
  hospital?:    string;  // optional — null for patients

  // Patient-specific
  dateOfBirth?: string;
  gender?:      string;
  doctorId?:    string;
}