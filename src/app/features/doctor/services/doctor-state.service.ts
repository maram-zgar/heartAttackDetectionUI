import { Injectable, inject, signal, computed } from '@angular/core';
import { DoctorApiService } from './doctor-api.service';
import {
  DoctorProfile, PatientResponse,
  AppointmentResponse, AppointmentStatus
} from '../models/doctor.model';
import { forkJoin } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DoctorStateService {
  private api = inject(DoctorApiService);

  // ── Raw signals ──────────────────────────────────────────────────────────────
  doctorProfile = signal<DoctorProfile | null>(null);
  patients      = signal<PatientResponse[]>([]);
  appointments  = signal<AppointmentResponse[]>([]);
  loading       = signal(false);

  activeConsultationPatient = signal<PatientResponse | null>(null);

  // ── Derived / computed ───────────────────────────────────────────────────────
  patientCount = computed(() => this.patients().length);

  pendingRequestsCount = computed(() =>
    this.appointments().filter(a => a.status === 'PENDING').length
  );

  todayAppointments = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.appointments().filter(a =>
      a.scheduledAt.startsWith(today) &&
      (a.status === 'ACCEPTED' || a.status === 'PENDING')
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
      .filter(a => a.status === 'ACCEPTED' && new Date(a.scheduledAt) > new Date())
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  );

  pendingAppointments = computed(() =>
    this.appointments()
      .filter(a => a.status === 'PENDING')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  );

  // ── Actions ──────────────────────────────────────────────────────────────────
  loadAll(): void {
    this.loading.set(true);
    forkJoin({
      profile:      this.api.getMe(),
      patients:     this.api.getAllPatients(),
      appointments: this.api.getAllAppointments(),
    }).subscribe({
      next: ({ profile, patients, appointments }) => {
        this.doctorProfile.set(profile);
        this.patients.set(patients);
        this.appointments.set(appointments);
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
    this.api.getAllPatients().subscribe(data => this.patients.set(data));
  }
}