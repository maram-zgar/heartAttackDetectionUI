import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, catchError, finalize, forkJoin, of, takeUntil } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../core/auth/auth.service';
import { AppointmentService } from '../../core/http/appointment.service';
import { DoctorService, Patient } from '../../core/http/doctor.service';
import { MedicalFileService } from '../../core/http/medical-file.service';
import { PredictionService } from '../../core/http/prediction.service';
import { UserProfile } from '../../shared/models/user-profile.model';
import {
  Appointment,
  AppointmentRequest,
  AppointmentStatus,
  Consultation,
  MedicalFile,
  PredictionPayload,
  PredictionResult,
} from '../../shared/models/medical.model';

type NavSection = 'overview' | 'patients' | 'appointments' | 'medical-file';
type MonitorRange = 'day' | 'week' | 'month';

interface SelectOption<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-doctor-dashboard',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    DatePickerModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    SkeletonModule,
    TableModule,
    TabsModule,
    TagModule,
    TextareaModule,
    ToastModule,
    TooltipModule,
  ],
  providers: [MessageService],
  templateUrl: './doctor-dashboard.component.html',
  styleUrls: ['./doctor-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorDashboardComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly doctorService = inject(DoctorService);
  private readonly appointmentService = inject(AppointmentService);
  private readonly medicalFileService = inject(MedicalFileService);
  private readonly predictionService = inject(PredictionService);
  private readonly messageService = inject(MessageService);
  private readonly fb = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();

  readonly navItems: SelectOption<NavSection>[] = [
    { label: "Vue d'ensemble", value: 'overview' },
    { label: 'Patients', value: 'patients' },
    { label: 'Rendez-vous', value: 'appointments' },
    { label: 'Dossier médical', value: 'medical-file' },
  ];

  readonly rangeOptions: SelectOption<MonitorRange>[] = [
    { label: 'Jour', value: 'day' },
    { label: 'Semaine', value: 'week' },
    { label: 'Mois', value: 'month' },
  ];

  readonly patientSexOptions: SelectOption<boolean>[] = [
    { label: 'Homme', value: true },
    { label: 'Femme', value: false },
  ];

  readonly binaryOptions: SelectOption<boolean>[] = [
    { label: 'Oui', value: true },
    { label: 'Non', value: false },
  ];

  readonly activeNav = signal<NavSection>('overview');
  readonly sidebarCollapsed = signal(false);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly predicting = signal(false);
  readonly checkingAvailability = signal(false);

  readonly currentUser = signal<UserProfile | null>(null);
  readonly patients = signal<Patient[]>([]);
  readonly appointments = signal<Appointment[]>([]);
  readonly selectedPatient = signal<Patient | null>(null);
  readonly medicalFile = signal<MedicalFile | null>(null);
  readonly predictionResult = signal<PredictionResult | null>(null);
  readonly selectedAppointment = signal<Appointment | null>(null);
  readonly monitorRange = signal<MonitorRange>('day');
  readonly monitorDate = signal(new Date());
  readonly availableSlots = signal<string[]>([]);

  readonly appointmentDialogVisible = signal(false);
  readonly consultationDialogVisible = signal(false);

  readonly doctorName = computed(() => {
    const user = this.currentUser();
    return user ? `${user.firstName} ${user.lastName}` : 'Médecin';
  });

  readonly doctorInitials = computed(() => {
    const user = this.currentUser();
    return user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : 'MD';
  });

  readonly patientOptions = computed<SelectOption<string>[]>(() =>
    this.patients().map((patient) => ({
      label: `${patient.firstName} ${patient.lastName}`,
      value: String(patient.id),
    })),
  );

  readonly doctorAppointments = computed(() => {
    const doctorId = this.currentUser()?.id;
    return doctorId
      ? this.appointments().filter((appointment) => appointment.doctorId === doctorId)
      : this.appointments();
  });

  readonly monitoredAppointments = computed(() => {
    const target = this.startOfDay(this.monitorDate());
    const range = this.monitorRange();
    return this.doctorAppointments()
      .filter((appointment) => this.isInRange(new Date(appointment.dateTime), target, range))
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  });

  readonly todayAppointments = computed(() => {
    const today = this.startOfDay(new Date());
    return this.doctorAppointments().filter((appointment) =>
      this.isInRange(new Date(appointment.dateTime), today, 'day'),
    );
  });

  readonly pendingAppointments = computed(() =>
    this.doctorAppointments().filter((appointment) => appointment.status === 'PENDING'),
  );

  readonly completedAppointments = computed(() =>
    this.doctorAppointments().filter((appointment) => appointment.status === 'COMPLETED'),
  );

  readonly appointmentForm = this.fb.nonNullable.group({
    patientId: ['', Validators.required],
    date: [new Date(), Validators.required],
    hospital: ['', Validators.required],
  });

  readonly consultationForm = this.fb.nonNullable.group({
    diagnosis: [''],
    notes: ['', Validators.required],
  });

  readonly predictionForm = this.fb.nonNullable.group({
    age: [58, [Validators.required, Validators.min(1), Validators.max(120)]],
    sex: [true, Validators.required],
    chestPainType: [0, Validators.required],
    restingBloodPressure: [120, Validators.required],
    cholesterol: [200, Validators.required],
    fastingBloodSugar: [false, Validators.required],
    restingECG: [0, Validators.required],
    maxHeartRateAchieved: [150, Validators.required],
    exerciseInducedAngina: [false, Validators.required],
    STDepressionInducedByExercise: [0, Validators.required],
    slopeOfPeakExerciseSTSegment: [1, Validators.required],
    nbOfMajorVessels: [0, Validators.required],
    thalassemia: [2, Validators.required],
  });

  ngOnInit(): void {
    this.loadAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAll(): void {
    this.loading.set(true);
    forkJoin({
      profile: this.auth.getUserProfile(),
      patients: this.doctorService.getPatients().pipe(catchError(() => of([]))),
      appointments: this.appointmentService.findAll().pipe(catchError(() => of([]))),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: ({ profile, patients, appointments }) => {
          this.currentUser.set(profile);
          this.patients.set(patients);
          this.appointments.set(appointments);
          this.appointmentForm.patchValue({ hospital: profile.hospital ?? '' });
        },
        error: () => this.showError('Impossible de charger le tableau de bord.'),
      });
  }

  navigateTo(section: NavSection): void {
    this.activeNav.set(section);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((value) => !value);
  }

  openMedicalFile(patient: Patient): void {
    this.selectedPatient.set(patient);
    this.activeNav.set('medical-file');
    this.medicalFile.set(null);
    this.medicalFileService
      .getByPatientId(String(patient.id))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (file) => this.medicalFile.set(this.withSortedConsultations(file)),
        error: () => this.showError('Impossible de charger le dossier médical.'),
      });
  }

  openAppointmentDialog(patient?: Patient): void {
    const user = this.currentUser();
    this.availableSlots.set([]);
    this.appointmentForm.reset({
      patientId: patient ? String(patient.id) : '',
      date: new Date(),
      hospital: user?.hospital ?? '',
    });
    this.appointmentDialogVisible.set(true);
    this.checkAvailability();
  }

  checkAvailability(): void {
    const doctorId = this.currentUser()?.id;
    const date = this.appointmentForm.controls.date.value;
    if (!doctorId || !date) return;

    this.checkingAvailability.set(true);
    this.appointmentService
      .getAvailableSlots(doctorId, this.toDateOnly(date))
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.checkingAvailability.set(false)),
      )
      .subscribe({
        next: (response) => this.availableSlots.set(response.slots),
        error: () => {
          this.availableSlots.set([]);
          this.showError('Disponibilité du médecin introuvable pour cette date.');
        },
      });
  }

  submitAppointment(): void {
    if (this.appointmentForm.invalid || !this.currentUser()) {
      this.appointmentForm.markAllAsTouched();
      return;
    }

    const patient = this.patients().find(
      (item) => String(item.id) === this.appointmentForm.controls.patientId.value,
    );
    if (!patient) {
      this.showError('Patient introuvable.');
      return;
    }

    const request: AppointmentRequest = {
      patientId: String(patient.id),
      doctorId: this.currentUser()!.id,
      dateTime: this.toDateOnly(this.appointmentForm.controls.date.value),
      hospital: this.appointmentForm.controls.hospital.value,
      patientEmail: patient.email,
      patientFirstName: patient.firstName,
    };

    this.submitting.set(true);
    this.appointmentService
      .create(request)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        next: (appointment) => {
          this.appointments.update((list) => [appointment, ...list]);
          this.appointmentDialogVisible.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Rendez-vous créé',
            detail: 'La demande est enregistrée selon la disponibilité du médecin.',
          });
        },
        error: (error: unknown) => this.showError(this.errorMessage(error)),
      });
  }

  confirmAppointment(appointment: Appointment): void {
    this.appointmentService
      .confirm(appointment.id, this.toAppointmentIdentity(appointment))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => this.replaceAppointment(updated),
        error: (error: unknown) => this.showError(this.errorMessage(error)),
      });
  }

  cancelAppointment(appointment: Appointment): void {
    this.appointmentService
      .cancel(appointment.id, this.toAppointmentIdentity(appointment))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => this.replaceAppointment(updated),
        error: (error: unknown) => this.showError(this.errorMessage(error)),
      });
  }

  openConsultation(appointment: Appointment): void {
    const patient = this.patients().find((item) => String(item.id) === appointment.patientId);
    if (patient) {
      this.selectedPatient.set(patient);
    }
    this.selectedAppointment.set(appointment);
    this.predictionResult.set(null);
    this.consultationForm.reset({ diagnosis: '', notes: '' });
    this.consultationDialogVisible.set(true);
  }

  runPrediction(): void {
    if (this.predictionForm.invalid) {
      this.predictionForm.markAllAsTouched();
      return;
    }

    this.predicting.set(true);
    this.predictionService
      .predict(this.predictionForm.getRawValue() as PredictionPayload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.predicting.set(false)),
      )
      .subscribe({
        next: (result) =>
          this.predictionResult.set({
            ...result,
            createdAt: new Date().toISOString(),
            payload: this.predictionForm.getRawValue() as PredictionPayload,
          }),
        error: () => this.showError('Le service de prédiction est indisponible.'),
      });
  }

  saveConsultation(): void {
    const appointment = this.selectedAppointment();
    if (!appointment || this.consultationForm.invalid) {
      this.consultationForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.appointmentService
      .complete(appointment.id, this.toAppointmentIdentity(appointment))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (completed) => {
          this.replaceAppointment(completed);
          this.medicalFileService
            .saveConsultation({
              appointmentId: completed.id,
              patientId: completed.patientId,
              doctorId: completed.doctorId,
              notes: this.consultationForm.controls.notes.value,
              diagnosis: this.consultationForm.controls.diagnosis.value,
              predictionResult: this.predictionResult() ?? undefined,
            })
            .pipe(
              takeUntil(this.destroy$),
              finalize(() => this.submitting.set(false)),
            )
            .subscribe({
              next: (consultation) => this.afterConsultationSaved(consultation),
              error: () => {
                this.submitting.set(false);
                this.showError('Le rendez-vous est terminé, mais les notes doivent être vérifiées côté dossier.');
              },
            });
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.showError(this.errorMessage(error));
        },
      });
  }

  patientName(patientId: string): string {
    const patient = this.patients().find((item) => String(item.id) === patientId);
    return patient ? `${patient.firstName} ${patient.lastName}` : 'Patient';
  }

  patientEmail(patientId: string): string {
    return this.patients().find((item) => String(item.id) === patientId)?.email ?? '';
  }

  initials(first?: string, last?: string): string {
    return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || 'PT';
  }

  statusLabel(status: AppointmentStatus | string | undefined): string {
    const map: Record<string, string> = {
      PENDING: 'En attente',
      CONFIRMED: 'Confirmé',
      CANCELLED: 'Annulé',
      COMPLETED: 'Terminé',
    };
    return status ? map[status] ?? status : 'Inconnu';
  }

  statusSeverity(status: AppointmentStatus | string | undefined): 'success' | 'danger' | 'warn' | 'info' | 'secondary' {
    const map: Record<string, 'success' | 'danger' | 'warn' | 'info' | 'secondary'> = {
      PENDING: 'warn',
      CONFIRMED: 'info',
      CANCELLED: 'danger',
      COMPLETED: 'success',
    };
    return status ? map[status] ?? 'secondary' : 'secondary';
  }

  formatDate(value?: string): string {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  riskText(result?: PredictionResult): string {
    if (!result) return 'Aucune prédiction';
    return result.prediction === 1 ? 'Risque élevé' : 'Risque faible';
  }

  private afterConsultationSaved(consultation: Consultation): void {
    this.consultationDialogVisible.set(false);
    this.messageService.add({
      severity: 'success',
      summary: 'Consultation enregistrée',
      detail: 'La consultation est ajoutée au dossier médical du patient.',
    });
    const current = this.medicalFile();
    if (current && current.patientId === consultation.patientId) {
      this.medicalFile.set(
        this.withSortedConsultations({
          ...current,
          consultations: [consultation, ...current.consultations],
          updatedAt: new Date().toISOString(),
        }),
      );
    }
  }

  private replaceAppointment(updated: Appointment): void {
    this.appointments.update((list) =>
      list.map((appointment) => (appointment.id === updated.id ? updated : appointment)),
    );
  }

  private toAppointmentIdentity(appointment: Appointment): Partial<AppointmentRequest> {
    const patient = this.patients().find((item) => String(item.id) === appointment.patientId);
    return {
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      dateTime: appointment.dateTime,
      hospital: appointment.hospital,
      patientEmail: patient?.email ?? appointment.patientEmail,
      patientFirstName: patient?.firstName ?? appointment.patientFirstName,
    };
  }

  private withSortedConsultations(file: MedicalFile): MedicalFile {
    return {
      ...file,
      consultations: [...file.consultations].sort(
        (a, b) =>
          new Date(b.dateDeConsultation).getTime() - new Date(a.dateDeConsultation).getTime(),
      ),
    };
  }

  private isInRange(value: Date, start: Date, range: MonitorRange): boolean {
    const day = this.startOfDay(value).getTime();
    const begin = start.getTime();
    if (range === 'day') return day === begin;
    if (range === 'week') {
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return day >= begin && day < end.getTime();
    }
    return value.getFullYear() === start.getFullYear() && value.getMonth() === start.getMonth();
  }

  private startOfDay(value: Date): Date {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private toDateOnly(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private showError(detail: string): void {
    this.messageService.add({ severity: 'error', summary: 'Erreur', detail });
  }

  private errorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const body = (error as { error?: { message?: string } }).error;
      return body?.message ?? 'Action impossible.';
    }
    return 'Action impossible.';
  }
}