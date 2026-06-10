import { Injectable, inject, signal, computed } from '@angular/core';
import { DoctorApiService } from './doctor-api.service';
import {
  DoctorProfile, PatientResponse,
  AppointmentResponse, AppointmentStatus
} from '../models/doctor.model';
import { forkJoin, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';

@Injectable({ providedIn: 'root' })
export class DoctorStateService {
  private api = inject(DoctorApiService);
  private readonly authService = inject(AuthService);

  doctorProfile = signal<DoctorProfile | null>(null);
  patients      = signal<PatientResponse[]>([]);
  appointments  = signal<AppointmentResponse[]>([]);
  loading       = signal(false);

  activeConsultationPatient = signal<PatientResponse | null>(null);

  patientCount = computed(() => this.patients().length);

  pendingRequestsCount = computed(() =>
    this.appointments().filter(a => a.status === 'PENDING').length
  );

  todayAppointments = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.appointments().filter(a =>
      a.scheduledAt.startsWith(today) &&
      (a.status === 'CONFIRMED' || a.status === 'PENDING')
    ).length;
  });

  monthConsultations = computed(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.appointments().filter(a =>
      a.status === 'COMPLETED' && a.scheduledAt.startsWith(ym)
    ).length;
  });

  upcomingAppointments = computed(() =>
    this.appointments()
      .filter(a => a.status === 'CONFIRMED' && new Date(a.scheduledAt) > new Date())
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  );

  pendingAppointments = computed(() =>
    this.appointments()
      .filter(a => a.status === 'PENDING')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  );

  loadAll(): void {
    this.loading.set(true);
    this.authService.getUserProfile().pipe(
      switchMap(profile => {
        if (profile.role !== 'DOCTOR') {
          return of({ profile, patients: [] as PatientResponse[], appointments: [] as AppointmentResponse[] });
        }
        return forkJoin({
          patients:     this.api.getAllPatients(profile.id),
          appointments: this.api.getAllAppointments(),
        }).pipe(
          map(({ patients, appointments }) => ({ profile, patients, appointments }))
        );
      })
    ).subscribe({
      next: (result: { profile: any; patients: PatientResponse[]; appointments: AppointmentResponse[] }) => {
        this.doctorProfile.set(result.profile as DoctorProfile);
        this.patients.set(result.patients);
        this.appointments.set(result.appointments);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  setActiveConsultationPatient(patient: PatientResponse | null): void {
    this.activeConsultationPatient.set(patient);
  }

  updateProfile(profile: Partial<DoctorProfile>): void {
    const current = this.doctorProfile();
    if (current) {
      this.doctorProfile.set({ ...current, ...profile });
    }
  }

  updateAppointmentStatus(id: string, status: AppointmentStatus): void {
    this.appointments.update(list =>
      list.map(a => a.id === id ? { ...a, status } : a)
    );
  }

  addPatient(patient: PatientResponse): void {
    this.patients.update(list => [patient, ...list]);
  }

  reloadAppointments(): void {
    this.api.getAllAppointments().subscribe(data => this.appointments.set(data));
  }

  reloadPatients(): void {
    const doctorId = this.doctorProfile()?.id;
    if (!doctorId) return;
    this.api.getAllPatients(doctorId).subscribe(data => this.patients.set(data));
  }
}