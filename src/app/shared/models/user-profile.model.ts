export type UserRole = 'ADMIN' | 'DOCTOR' | 'PATIENT';

export interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}