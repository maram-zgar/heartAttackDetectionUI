import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  PLATFORM_ID,
  Inject,
  signal,
  computed,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { forkJoin, Observable, Subject } from 'rxjs';
import { takeUntil, catchError, finalize, filter, switchMap, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { Skeleton } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  NonNullableFormBuilder,
  FormControl,
} from '@angular/forms';
import { PasswordModule } from 'primeng/password';
import { InputNumberModule } from 'primeng/inputnumber';
import { DrawerModule } from 'primeng/drawer';

// ── Shared model types – single source of truth ────────────────────────────
import {
  Appointment,
  AppointmentRequest,
  Consultation,
  MedicalFile,
  PredictionPayload,
  PredictionResult,
} from '../../shared/models/medical.model';

// ── DoctorService – Patient CRUD + legacy consultation helper only ──────────
import {
  DoctorService,
  Patient,
  ConsultationComplete,
} from '../../core/http/doctor.service';

import { selectCurrentUser } from '../../store/auth/auth.selectors';
import { AuthService } from '../../core/auth/auth.service';
import { AppointmentService } from '../../core/http/appointment.service';
import { MedicalFileService } from '../../core/http/medical-file.service';
import { PredictionService } from '../../core/http/prediction.service';
import { SelectModule } from 'primeng/select';
import { UserProfile } from '../../shared/models/user-profile.model';
import { sign } from 'crypto';
import { DoctorTimetableComponent } from './components/timetable/doctor-timetable.component';
import { PatientService, PatientProfile } from '../../core/http/patient.service';

// ─────────────────────────────────────────────────────────────────────────────
//  Local types
// ─────────────────────────────────────────────────────────────────────────────

type NavSection = 'overview' | 'patients' | 'appointments' | 'prediction' | 'medical-file' | 'settings' | 'availability';
type MonitorRange = 'day' | 'week' | 'month';

interface SelectOption<T> {
  label: string;
  value: T;
}

/** Explicit shape for the appointment form so bracket-access is typed. */
interface AppointmentFormValue {
  patientId: string;
  date: Date;
}

@Component({
  selector: 'app-doctor-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    AvatarModule,
    BadgeModule,
    TooltipModule,
    TagModule,
    TableModule,
    TabsModule,
    SelectModule,
    DatePickerModule,
    ToastModule,
    ConfirmDialogModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    PasswordModule,
    Skeleton,
    DrawerModule,
    DoctorTimetableComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './doctor-dashboard.component.html',
  styleUrls: ['./doctor-dashboard.component.scss'],
})
export class DoctorDashboardComponent implements OnInit, OnDestroy {

onTimetableSlotSelected(payload: string): void {
  if (payload.startsWith('reschedule:')) {
    const appointmentId = payload.replace('reschedule:', '');
    const appt = this.appointments().find(a => String(a.id) === appointmentId);
    if (appt) this.openRescheduleDialog(appt);
    return;
  }
  // free slot → open booking dialog
  this.availableSlots.set([payload]);
  this.appointmentForm.reset({
    patientId:       '',
    date:            new Date(payload),
    selectedSlot:    payload,
    appointmentType: 'CONSULTATION',
  });
  this.appointmentDialogVisible.set(true);
}

  // ── DI ────────────────────────────────────────────────────────────────────
  private readonly store = inject(Store);
  private readonly user = this.store.selectSignal(selectCurrentUser);
  private readonly doctorService = inject(DoctorService);
  private readonly appointmentService = inject(AppointmentService);
  private readonly medicalFileService = inject(MedicalFileService);
  private readonly predictionService = inject(PredictionService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly authService = inject(AuthService);
  @Inject(PLATFORM_ID) private platformId: object = inject(PLATFORM_ID);
  private readonly patientService = inject(PatientService);
  private readonly destroy$ = new Subject<void>();
  profileModalVisible = signal(false);

  // ─────────────────────────────────────────────────────────────────────────
  //  Static select options
  // ─────────────────────────────────────────────────────────────────────────

  readonly rangeOptions: SelectOption<MonitorRange>[] = [
    { label: 'Jour',    value: 'day' },
    { label: 'Semaine', value: 'week' },
    { label: 'Mois',    value: 'month' },
  ];

  readonly patientSexOptions: SelectOption<number>[] = [
    { label: 'Homme', value: 1 },
    { label: 'Femme', value: 0 },
  ];

  readonly binaryOptions: SelectOption<boolean>[] = [
    { label: 'Oui', value: true },
    { label: 'Non', value: false },
  ];

  readonly chestPainOptions: SelectOption<number>[] = [
    { label: 'Angine Typique',       value: 0 },
    { label: 'Angine Atypique',      value: 1 },
    { label: 'Douleur Non-Angineuse', value: 2 },
    { label: 'Asymptomatique',       value: 3 },
  ];

  readonly ecgOptions: SelectOption<number>[] = [
    { label: 'Normal',                  value: 0 },
    { label: 'Anomalie ST-T',           value: 1 },
    { label: 'Hypertrophie Ventriculaire', value: 2 },
  ];

  readonly navItems: { id: NavSection; label: string; icon: string }[] = [
    { id: 'overview',      label: "Vue d'ensemble", icon: 'pi-home' },
    { id: 'patients',      label: 'Patients',        icon: 'pi-users' },
    { id: 'appointments',  label: 'Rendez-vous',     icon: 'pi-calendar' },
    { id: 'prediction',    label: 'Analyse IA',      icon: 'pi-chart-line' },
    { id: 'medical-file',  label: 'Dossiers',        icon: 'pi-folder-open' },
    { id: 'availability',  label: 'Disponibilités',  icon: 'pi-clock'},
  ];

  // ─────────────────────────────────────────────────────────────────────────
  //  Signals – loading
  // ─────────────────────────────────────────────────────────────────────────

  readonly loading = signal(false); 
  readonly loadingMedicalFile = signal(false);
  readonly loadingPatients      = signal(false);
  readonly loadingAppointments  = signal(false);
  readonly loadingAvailability  = signal(false);
  readonly submitting           = signal(false);
  readonly predicting           = signal(false);
  readonly checkingAvailability = signal(false);
  readonly submittingConsultation  = signal(false);
  readonly submittingAddPatient    = signal(false);
  readonly submittingEditPatient   = signal(false);
  readonly submittingChangePassword = signal(false);
  readonly submittingUpdateDoctor  = signal(false);
  readonly patientSearchQuery = signal('');

  // ─────────────────────────────────────────────────────────────────────────
  //  Signals – data
  // ─────────────────────────────────────────────────────────────────────────

  readonly currentUser       = signal<UserProfile | null>(null);
  readonly patients          = signal<Patient[]>([]);
  readonly appointments      = signal<Appointment[]>([]);
  readonly medicalFile       = signal<MedicalFile | null>(null);
  readonly availability      = signal<any[]>([]);
  readonly selectedAppointment = signal<Appointment | null>(null);
  readonly selectedPatient     = signal<Patient | null>(null);
  readonly selectedPatientDetail  = signal<Patient | null>(null);
  readonly selectedPatientForEdit = signal<Patient | null>(null);
  readonly monitorRange = signal<MonitorRange>('day');
  readonly monitorDate  = signal(new Date());
  readonly availableSlots = signal<string[]>([]);
  readonly errorPatients     = signal<string | null>(null);
  readonly errorAppointments = signal<string | null>(null);

  readonly predictionResult = signal<(PredictionResult & {
    createdAt?: string;
    payload?: PredictionPayload;
  }) | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  //  Signals – UI
  // ─────────────────────────────────────────────────────────────────────────

  readonly sidebarCollapsed  = signal(false);
  readonly settingsPanelOpen = signal(false);
  readonly activeNav         = signal<NavSection>('overview');

  readonly appointmentDialogVisible  = signal(false);
  readonly consultationDialogVisible = signal(false);
  readonly patientDetailVisible      = signal(false);
  readonly addPatientVisible         = signal(false);
  readonly editPatientVisible        = signal(false);

  isDark = false;

  /**
   * Plain mutable properties used for [(ngModel)] two-way binding on the
   * appointments toolbar's p-select / p-datepicker.
   * On change they update the corresponding signals so computed() re-runs.
   */
  get monitorRangeModel(): MonitorRange { return this.monitorRange(); }
  set monitorRangeModel(v: MonitorRange) { this.monitorRange.set(v); }

  get monitorDateModel(): Date { return this.monitorDate(); }
  set monitorDateModel(v: Date) { this.monitorDate.set(v); }

  // ─────────────────────────────────────────────────────────────────────────
  //  Doctor display info
  // ─────────────────────────────────────────────────────────────────────────

  readonly doctorName     = signal('Médecin');
  readonly doctorEmail    = signal('');
  readonly doctorInitials = signal('MD');

  // ─────────────────────────────────────────────────────────────────────────
  //  Computed
  // ─────────────────────────────────────────────────────────────────────────

  readonly patientOptions = computed<SelectOption<string>[]>(() =>
    this.patients().map(p => ({
      label: `${p.firstName} ${p.lastName}`,
      value: String(p.id),
    })),
  );

  readonly doctorAppointments = computed(() => {
    const doctorId = this.currentUser()?.id;
    if (!doctorId) return this.appointments();
    return this.appointments().filter(
      a => String(a.doctorId).toLowerCase() === String(doctorId).toLowerCase()
    );
  });

  readonly monitoredAppointments = computed(() => {
    const target = this.startOfDay(this.monitorDate());
    const range  = this.monitorRange();
    const all    = this.doctorAppointments();
    console.log('[monitored] date=', target, 'range=', range, 'doctorAppts=', all.length, 'total=', this.appointments().length);
    return all
      .filter(a => this.isInRange(new Date(a.dateTime), target, range))
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  });

  readonly completedAppointments = computed(() =>
    this.doctorAppointments().filter(a => a.status === 'COMPLETED'),
  );

  readonly pendingAppointments = computed(() =>
    this.appointments().filter(a => a.status === 'PENDING'),
  );

  readonly todayAppointments = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.appointments().filter(a => a.dateTime?.startsWith(today));
  });

  readonly todayAppointmentsList = computed(() =>
    this.todayAppointments().slice(0, 5),
  );

  readonly filteredPatientAppointments = computed(() => {
    const pid = this.selectedPatient()?.id;
    if (!pid) return [];
    return this.appointments().filter(a => String(a.patientId) === String(pid));
  });

  readonly filteredPatients = computed(() => {
    const q = this.patientSearchQuery().toLowerCase().trim();
    if (!q) return this.patients();
    return this.patients().filter(p =>
      `${p.firstName} ${p.lastName} ${p.email}`.toLowerCase().includes(q)
    );
  });

  // ── Slot / type / duration helpers ──────────────────────────────────────────

  /** ISO slot strings → HH:mm dropdown options */
  readonly slotOptions = computed(() =>
    this.availableSlots().map(s => ({ label: s.substring(11, 16), value: s }))
  );

  readonly appointmentTypeOptions = [
    { label: 'Consultation', value: 'CONSULTATION' },
    { label: 'Bilan',        value: 'CHECKUP'      },
    { label: 'Chirurgie',    value: 'SURGERY'      },
    { label: 'Suivi',        value: 'FOLLOW_UP'    },
  ];

  readonly durationOptions = [
    { label: '15 min',   value: 15  },
    { label: '30 min',   value: 30  },
    { label: '45 min',   value: 45  },
    { label: '1 heure',  value: 60  },
    { label: '1h 30',    value: 90  },
    { label: '2 heures', value: 120 },
  ];

  typeLabel(type: string | undefined): string {
    const map: Record<string, string> = {
      CONSULTATION: 'Consultation', CHECKUP: 'Bilan',
      SURGERY: 'Chirurgie', FOLLOW_UP: 'Suivi',
    };
    return type ? (map[type] ?? type) : 'Consultation';
  }

  typeClass(type: string | undefined): string {
    const map: Record<string, string> = {
      CONSULTATION: 'type-consult', CHECKUP: 'type-checkup',
      SURGERY: 'type-surgery', FOLLOW_UP: 'type-followup',
    };
    return type ? (map[type] ?? 'type-consult') : 'type-consult';
  }

  // ── Reschedule ──────────────────────────────────────────────────────────────

  readonly rescheduleDialogVisible = signal(false);
  readonly rescheduleTarget        = signal<Appointment | null>(null);
  readonly rescheduleAvailSlots    = signal<string[]>([]);
  readonly loadingRescheduleSlots  = signal(false);

  rescheduleForm = this.fb.nonNullable.group({
    date:         this.fb.nonNullable.control(new Date(), Validators.required),
    selectedSlot: this.fb.nonNullable.control('',        Validators.required),
  });

  readonly rescheduleSlotOptions = computed(() =>
    this.rescheduleAvailSlots().map(s => ({ label: s.substring(11, 16), value: s }))
  );

  openRescheduleDialog(appt: Appointment): void {
    this.rescheduleTarget.set(appt);
    this.rescheduleAvailSlots.set([]);
    this.rescheduleForm.reset({ date: new Date(), selectedSlot: '' });
    this.rescheduleDialogVisible.set(true);
  }

  loadRescheduleSlots(): void {
    const appt     = this.rescheduleTarget();
    const doctorId = appt?.doctorId ?? this.currentUser()?.id;
    const date     = this.rescheduleForm.controls.date.value;
    if (!doctorId || !date) return;

    this.rescheduleForm.controls.selectedSlot.setValue('');
    this.rescheduleAvailSlots.set([]);
    this.loadingRescheduleSlots.set(true);
    this.appointmentService
      .getAvailableSlots(doctorId, this.toDateOnly(date))
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingRescheduleSlots.set(false)))
      .subscribe({
        next:  r => this.rescheduleAvailSlots.set(r.slots),
        error: () => this.rescheduleAvailSlots.set([]),
      });
  }

  submitReschedule(): void {
    const appt = this.rescheduleTarget();
    if (!appt || this.rescheduleForm.invalid) { this.rescheduleForm.markAllAsTouched(); return; }

    const { selectedSlot } = this.rescheduleForm.getRawValue();
    const patient = this.patients().find(p => String(p.id) === String(appt.patientId));

    const req: AppointmentRequest = {
      patientId:        String(appt.patientId),
      doctorId:         appt.doctorId ?? this.currentUser()!.id,
      dateTime:         selectedSlot,
      patientEmail:     patient?.email     ?? (appt as any).patientEmail     ?? '',
      patientFirstName: patient?.firstName ?? (appt as any).patientFirstName ?? '',
    };

    this.submitting.set(true);
    this.appointmentService.reschedule(appt.id, req)
      .pipe(takeUntil(this.destroy$), finalize(() => this.submitting.set(false)))
      .subscribe({
        next: updated => {
          const enriched = {
            ...updated,
            patientFirstName: patient?.firstName ?? (appt as any).patientFirstName,
            patientLastName:  patient?.lastName  ?? (appt as any).patientLastName,
            appointmentType:  (appt as any).appointmentType,
          } as unknown as Appointment;
          this.replaceAppointment(enriched);
          this.rescheduleDialogVisible.set(false);
          this.messageService.add({ severity: 'success', summary: 'Reprogrammé', detail: 'Nouveau créneau enregistré.' });
          setTimeout(() => this.loadAppointments(), 500);
        },
        error: (err: unknown) => this.showError(this.errorMessage(err)),
      });
  }

  loadAvailability(): void {
    const doctorId = this.currentUser()?.id;
    if (!doctorId) return;

    this.loadingAvailability.set(true);

    this.appointmentService
      .getDoctorAvailability(doctorId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingAvailability.set(false))
      )
      .subscribe({
        next: data => this.availability.set(data),
        error: () => this.availability.set([])
      });
  }

  submitAvailability(): void {
    if (this.availabilityForm.invalid) {
      this.availabilityForm.markAllAsTouched();
      return;
    }

    const doctorId = this.currentUser()?.id;
    if (!doctorId) return;

    this.appointmentService
      .setDoctorAvailability(
        doctorId,
        this.availabilityForm.value
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Succès',
            detail: 'Disponibilité enregistrée'
          });

          this.loadAvailability();
        },
        error: () => {
          this.showError('Impossible d’enregistrer la disponibilité');
        }
      });
  }

  deleteAvailability(day: string): void {
    const doctorId = this.currentUser()?.id;
    if (!doctorId) return;

    this.appointmentService
      .deleteDoctorAvailability(doctorId, day)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadAvailability();
        }
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Forms  (typed with explicit FormGroup generics to avoid index-type errors)
  // ─────────────────────────────────────────────────────────────────────────

  /** Typed explicitly so controls['patientId'] etc. are accepted. */
  appointmentForm!: FormGroup<{
    patientId:       FormControl<string>;
    date:            FormControl<Date>;
    selectedSlot:    FormControl<string>;
    appointmentType: FormControl<string>;
  }>;

  consultationForm!:    FormGroup;
  addPatientForm!:      FormGroup;
  editPatientForm!:     FormGroup;
  changePasswordForm!:  FormGroup;
  predictionForm!:      FormGroup;
  updateDoctorForm!:    FormGroup;
  availabilityForm!:    FormGroup;

  // ─────────────────────────────────────────────────────────────────────────
  //  LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.buildForms();

    if (isPlatformBrowser(this.platformId)) {
      this.loadDarkMode();
    }

    this.store.select(selectCurrentUser).pipe(
      filter(user => !!user),
      takeUntil(this.destroy$),
    ).subscribe(user => {
      this.currentUser.set(user);
      this.doctorEmail.set(user.email);
      this.doctorName.set(`${user.firstName} ${user.lastName}`);
      this.doctorInitials.set(this.buildInitials(user.firstName, user.lastName));
      this.loadAllData();
    });

    this.loadDoctorProfile();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Medical file
  // ─────────────────────────────────────────────────────────────────────────

  openMedicalFile(patient: Patient): void {
    this.selectedPatient.set(patient);
    this.activeNav.set('medical-file');
    this.medicalFile.set(null);
    this.loadingMedicalFile.set(true);
    this.medicalFileService
      .getByPatientId(String(patient.id))
      .pipe(takeUntil(this.destroy$),
        finalize(() => this.loadingMedicalFile.set(false)) // Stop loading
      )
      .subscribe({
        next: file  => this.medicalFile.set(this.withSortedConsultations(file)),
        error: ()   => this.showError('Impossible de charger le dossier médical.'),
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Appointments
  // ─────────────────────────────────────────────────────────────────────────

  openAppointmentDialog(patient?: Patient): void {
    this.availableSlots.set([]);
    this.checkingAvailability.set(false);
    this.appointmentForm.reset({
      patientId:       patient ? String(patient.id) : '',
      date:            new Date(),
      selectedSlot:    '',
      appointmentType: 'CONSULTATION',
    });
    this.appointmentDialogVisible.set(true);
    this.checkAvailability();
  }

  checkAvailability(): void {
    const doctorId = this.currentUser()?.id;
    const date     = this.appointmentForm.controls.date.value;
    if (!doctorId || !date) return;

    // Clear stale slot whenever the date changes
    this.appointmentForm.controls.selectedSlot.setValue('');
    this.availableSlots.set([]);

    this.checkingAvailability.set(true);
    this.appointmentService
      .getAvailableSlots(doctorId, this.toDateOnly(date))
      .pipe(takeUntil(this.destroy$), finalize(() => this.checkingAvailability.set(false)))
      .subscribe({
        next:  r  => this.availableSlots.set(r.slots),
        error: () => this.availableSlots.set([]),
      });
  }

  submitAppointment(): void {
    if (this.appointmentForm.invalid || !this.currentUser()) {
      this.appointmentForm.markAllAsTouched();
      return;
    }

    const { patientId, selectedSlot, appointmentType } =
      this.appointmentForm.getRawValue();

    if (!selectedSlot) { this.showError('Veuillez sélectionner un créneau horaire.'); return; }

    const patient = this.patients().find(p => String(p.id) === patientId);
    if (!patient) { this.showError('Patient introuvable.'); return; }

    const request: AppointmentRequest = {
      patientId:        String(patient.id),
      doctorId:         this.currentUser()!.id,
      dateTime:         selectedSlot,   // full ISO e.g. '2025-06-16T09:00:00'
      patientEmail:     patient.email,
      patientFirstName: patient.firstName,
      appointmentType: appointmentType as AppointmentRequest['appointmentType'],
    };

    this.submitting.set(true);
    this.appointmentService.create(request).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.submitting.set(false)),
    ).subscribe({
      next: appt => {
  // Auto-confirm immediately since this was doctor-initiated
  this.appointmentService
    .confirm(appt.id, {
      patientId:        String(patient.id),
      doctorId:         this.currentUser()!.id,
      dateTime:         appt.dateTime,
      patientEmail:     patient.email,
      patientFirstName: patient.firstName,
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: confirmed => {
        const enriched = {
          ...confirmed,
          patientFirstName: patient.firstName,
          patientLastName:  patient.lastName,
          patientEmail:     patient.email,
          appointmentType,
        } as unknown as Appointment;
        this.appointments.update(list => [enriched, ...list]);
        this.appointmentDialogVisible.set(false);
        this.messageService.add({
          severity: 'success',
          summary:  'Rendez-vous confirmé',
          detail:   `${patient.firstName} ${patient.lastName} · ${appt.dateTime.substring(0,16).replace('T',' ')} — le patient sera notifié.`,
        });
      },
      error: () => {
        // confirm failed but create succeeded — add as PENDING at least
        const enriched = {
          ...appt,
          patientFirstName: patient.firstName,
          patientLastName:  patient.lastName,
          patientEmail:     patient.email,
          appointmentType,
        } as unknown as Appointment;
        this.appointments.update(list => [enriched, ...list]);
        this.appointmentDialogVisible.set(false);
      },
    });
      },
    });
  }

  confirmAppointment(appointment: Appointment): void {
    this.appointmentService
      .confirm(appointment.id, this.toAppointmentIdentity(appointment))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next:  updated => this.replaceAppointment(updated),
        error: (err: unknown) => this.showError(this.errorMessage(err)),
      });
  }

  cancelAppointment(appointment: Appointment): void {
    this.appointmentService
      .cancel(appointment.id, this.toAppointmentIdentity(appointment))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next:  updated => this.replaceAppointment(updated),
        error: (err: unknown) => this.showError(this.errorMessage(err)),
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Consultation
  // ─────────────────────────────────────────────────────────────────────────

  openConsultation(appointment: Appointment): void {
    const patient = this.patients().find(
      p => String(p.id) === String(appointment.patientId),
    );
    if (patient) this.selectedPatient.set(patient);
    this.selectedAppointment.set(appointment);
    this.predictionResult.set(null);
    this.consultationForm.reset({ diagnosis: '', notes: '' });
    this.consultationDialogVisible.set(true);
  }

  runPrediction(): void {
    if (this.predictionForm.invalid) { this.predictionForm.markAllAsTouched(); return; }

    this.predicting.set(true);
    this.predictionService
      .predict(this.predictionForm.getRawValue() as PredictionPayload)
      .pipe(takeUntil(this.destroy$), finalize(() => this.predicting.set(false)))
      .subscribe({
        next: result => this.predictionResult.set({
          ...result,
          createdAt: new Date().toISOString(),
          payload:   this.predictionForm.getRawValue() as PredictionPayload,
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
      .complete(appointment.id, {
        ...this.toAppointmentIdentity(appointment),
        notes:            this.consultationForm.controls['notes'].value,
        diagnosis:        this.consultationForm.controls['diagnosis'].value,
        predictionResult: this.predictionResult() ?? undefined,
      } as any)
      .pipe(takeUntil(this.destroy$), finalize(() => this.submitting.set(false)))
      .subscribe({
        next: completed => {
          this.replaceAppointment(completed);
          this.consultationDialogVisible.set(false);
          this.messageService.add({
            severity: 'success',
            summary:  'Consultation enregistrée',
            detail:   'Ajoutée au dossier médical.',
          });

          // Kafka is async — wait 1.5s for the consultation-service to process
          // the appointment.completed event, then reload the medical file
          const patient = this.selectedPatient();
          if (patient) {
            setTimeout(() => {
              this.medicalFileService
                .getByPatientId(String(patient.id))
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: file => this.medicalFile.set(this.withSortedConsultations(file)),
                  error: () => {} // silent — doctor can navigate to dossier manually
                });
            }, 1500);
          }
        },
        error: (err: unknown) => this.showError(this.errorMessage(err)),
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Patient CRUD
  // ─────────────────────────────────────────────────────────────────────────

  openAddPatient(): void {
    this.addPatientForm.reset();
    this.addPatientVisible.set(true);
  }

  submitAddPatient(): void {
    if (this.addPatientForm.invalid) { this.addPatientForm.markAllAsTouched(); return; }

    this.submittingAddPatient.set(true);

    const payload = {
      ...this.addPatientForm.value,
      doctorId: this.currentUser()?.id,
      age: Number(this.addPatientForm.value.age)
    };

    this.doctorService.createPatient(payload).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.submittingAddPatient.set(false)),
    ).subscribe({
      next: (uuid) => {
        this.messageService.add({
          severity: 'success',
          summary:  'Patient ajouté',
          detail:   'Le patient a été enregistré avec succès.',
        });
        this.addPatientVisible.set(false);
        this.addPatientForm.reset();
        this.loadPatients();
      },
      error: err => {
        const detail = err?.error?.message ?? "Impossible d'ajouter le patient.";
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail });
      },
    });
  }

  openEditPatient(patient: Patient): void {
    this.selectedPatientForEdit.set(patient);
    this.editPatientForm.patchValue({ ...patient });
    this.editPatientVisible.set(true);
  }

  submitEditPatient(): void {
    if (this.editPatientForm.invalid) { this.editPatientForm.markAllAsTouched(); return; }

    this.submittingEditPatient.set(true);
    const { id, ...data } = this.editPatientForm.value;

    this.doctorService.updatePatient(id, data).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.submittingEditPatient.set(false)),
    ).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Patient mis à jour.' });
        this.editPatientVisible.set(false);
        this.loadPatients();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Échec de la mise à jour.' }),
    });
  }

  confirmDeletePatient(patient: Patient): void {
    this.confirmationService.confirm({
      message:  `Supprimer ${patient.firstName} ${patient.lastName} ? Cette action est irréversible.`,
      header:   'Confirmation de suppression',
      icon:     'pi pi-exclamation-triangle',
      acceptLabel: 'Oui, supprimer',
      rejectLabel: 'Annuler',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.doctorService.deletePatient(patient.id).pipe(takeUntil(this.destroy$))
          .subscribe({
            next:  () => {
              this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Patient supprimé.' });
              this.loadPatients();
            },
            error: () => this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de supprimer ce patient.' }),
          });
      },
    });
  }

  onDobChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.value) return;
    const dob = new Date(input.value);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    this.addPatientForm.patchValue({ age });
    // Also pre-fill prediction form
    this.predictionForm.patchValue({ age });
  }

  openPatientDetail(patient: Patient): void {
    this.selectedPatientDetail.set(patient);
    this.patientDetailVisible.set(true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Doctor profile
  // ─────────────────────────────────────────────────────────────────────────

  submitUpdateDoctor(): void {
    if (this.updateDoctorForm.invalid) { this.updateDoctorForm.markAllAsTouched(); return; }

    this.submittingUpdateDoctor.set(true);
    const payload = this.updateDoctorForm.getRawValue();

    this.doctorService.updateDoctor(payload).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.submittingUpdateDoctor.set(false)),
    ).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Profil mis à jour', detail: 'Modifications enregistrées' });
        this.doctorName.set(`${payload.firstName} ${payload.lastName}`);
        this.doctorEmail.set(payload.email);
        this.doctorInitials.set(this.buildInitials(payload.firstName, payload.lastName));
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Échec de mise à jour' }),
    });
  }

  submitChangePassword(): void {
    if (this.changePasswordForm.invalid) { this.changePasswordForm.markAllAsTouched(); return; }

    this.submittingChangePassword.set(true);
    const { currentPassword, newPassword } = this.changePasswordForm.value;

    this.doctorService.changePassword({ currentPassword, newPassword, email: this.user()?.email! }).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.submittingChangePassword.set(false)),
    ).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary:  'Mot de passe modifié',
          detail:   'Votre mot de passe a été mis à jour avec succès.',
        });
        this.changePasswordForm.reset();
        this.settingsPanelOpen.set(false);
      },
      error: err => {
        const detail = err?.error?.message ?? 'Échec de la modification du mot de passe.';
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail });
      },
    });
  }

  onUpdateProfile(): void {
    if (this.updateDoctorForm.invalid) {
      this.updateDoctorForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.submittingUpdateDoctor.set(true);

    const payload = this.updateDoctorForm.getRawValue();
    this.doctorService.updateDoctor(payload).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.loading.set(false);
        this.submittingUpdateDoctor.set(false);
      })
    ).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Succès',
          detail: 'Profil mis à jour avec succès'
        });
        // Optionally update local currentUser signal with new data
      },
      error: (err: any) => this.showError(this.errorMessage(err))
    });
  }

  onChangePassword(): void {
    if (this.changePasswordForm.invalid) {
      this.changePasswordForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.submittingChangePassword.set(true);

    this.doctorService.changePassword(this.changePasswordForm.value).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.loading.set(false);
        this.submittingChangePassword.set(false);
      })
    ).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Succès',
          detail: 'Mot de passe modifié avec succès'
        });
        this.changePasswordForm.reset();
      },
      error: (err: any) => this.showError(this.errorMessage(err))
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Legacy consultation dialog (kept for backwards compat)
  // ─────────────────────────────────────────────────────────────────────────

  openConsultationDialog(patient: Patient, appointmentId = 0): void {
    this.selectedPatient.set(patient);
    this.consultationForm.patchValue({ appointmentId, notes: '', diagnosis: '' });
    this.consultationDialogVisible.set(true);
  }

  submitConsultation(): void {
    if (!this.consultationForm.get('notes')?.value?.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Champ requis', detail: 'Veuillez ajouter des notes.' });
      return;
    }
    this.submittingConsultation.set(true);
    const formValue = this.consultationForm.value as ConsultationComplete;
    this.doctorService.completeConsultation(formValue).pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: err?.error?.message ?? 'La soumission a échoué.' });
        return of(null);
      }),
      finalize(() => this.submittingConsultation.set(false)),
    ).subscribe(result => {
      if (result !== null) {
        this.messageService.add({ severity: 'success', summary: 'Consultation complétée', detail: 'Enregistrée avec succès.' });
        this.consultationDialogVisible.set(false);
        this.loadAppointments();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Navigation / UI
  // ─────────────────────────────────────────────────────────────────────────

  navigateTo(section: NavSection): void {
    this.activeNav.set(section);
    if (section === 'settings') {
      this.settingsPanelOpen.set(true);
    } else {
      this.settingsPanelOpen.set(false);
    }
  }
  toggleSidebar(): void  { this.sidebarCollapsed.update(v => !v); }
  toggleSettings(): void { this.settingsPanelOpen.update(v => !v); }

  loadAll(): void { 
    this.loadAllData();
    this.loadAvailability(); 
  }

  toggleDark(): void {
    this.isDark = !this.isDark;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cardiosense-dark', String(this.isDark));
      document.body.classList.toggle('dark-mode', this.isDark);
    }
  }

  logout(): void {
    // Clear tokens and redirect
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/authenticate';
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Display helpers
  // ─────────────────────────────────────────────────────────────────────────

  patientName(patientId: string | number): string {
    const p = this.patients().find(x => String(x.id) === String(patientId));
    return p ? `${p.firstName} ${p.lastName}` : 'Patient';
  }

  patientEmail(patientId: string | number): string {
    return this.patients().find(x => String(x.id) === String(patientId))?.email ?? '';
  }

  initials(first?: string, last?: string): string {
    return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || 'PT';
  }

  buildInitials(first?: string, last?: string, email?: string): string {
    if (first && last) return (first[0] + last[0]).toUpperCase();
    if (first) return first[0].toUpperCase();
    if (email) return email[0].toUpperCase();
    return 'MD';
  }

  statusLabel(status: string | undefined): string {
    const map: Record<string, string> = {
      PENDING: 'En attente', CONFIRMED: 'Confirmé', CANCELLED: 'Annulé', COMPLETED: 'Terminé',
    };
    return status ? (map[status] ?? status) : 'Inconnu';
  }

  statusSeverity(status: string | undefined): 'success' | 'danger' | 'warn' | 'info' | 'secondary' {
    const map: Record<string, 'success' | 'danger' | 'warn' | 'info' | 'secondary'> = {
      PENDING: 'warn', CONFIRMED: 'info', CANCELLED: 'danger', COMPLETED: 'success',
    };
    return status ? (map[status] ?? 'secondary') : 'secondary';
  }

  riskText(result?: PredictionResult | null): string {
    if (!result) return 'Aucune prédiction';
    return result.prediction === 1 ? 'Risque élevé' : 'Risque faible';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  }

  skeletonArray(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  isFieldInvalid(form: FormGroup, field: string): boolean {
    const ctrl = form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Data loading
  // ─────────────────────────────────────────────────────────────────────────

  loadAllData(): void {
    this.loadPatients();
    this.loadAppointments();
  }

  loadDoctorProfile(): void {
    this.authService.getUserProfile().pipe(takeUntil(this.destroy$)).subscribe({
      next: profile => {
        this.doctorName.set(`${profile.firstName} ${profile.lastName}`);
        this.doctorEmail.set(profile.email);
        this.doctorInitials.set(this.buildInitials(profile.firstName, profile.lastName));
        this.currentUser.set(profile as unknown as UserProfile);
        this.updateDoctorForm.patchValue({
          id:         profile.id,
          firstName:  profile.firstName,
          lastName:   profile.lastName,
          email:      profile.email,
          numeroRPPS: (profile as any).numeroRPPS,
        });
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les informations du médecin.' }),
    });
  }

  loadPatients(): void {
    this.loadingPatients.set(true);
    this.errorPatients.set(null);
    this.doctorService.getPatients().pipe(takeUntil(this.destroy$)).subscribe({
      next: patients => {
        this.patients.set(patients);
        this.loadingPatients.set(false);
        this.cdr.detectChanges();
      },
      error: err => {
        this.errorPatients.set(err?.error?.message ?? 'Impossible de charger les patients.');
        this.patients.set([]);
        this.loadingPatients.set(false);
        this.cdr.detectChanges();
      },
    });
  }

  loadAppointments(): void {
    this.loadingAppointments.set(true);
    this.errorAppointments.set(null);

    this.appointmentService.findAll().pipe(
      switchMap(appointments => {
        if (!appointments.length) return of([]);

        // Deduplicate patient IDs to avoid redundant calls
        const uniquePatientIds = [...new Set(appointments.map(a => String(a.patientId)))];

        return forkJoin(
          uniquePatientIds.reduce((acc, id) => {
            acc[id] = this.patientService.getProfile(id).pipe(      
              catchError(() => of({ firstName: '', lastName: '', email: '' } as any)));
            return acc;
          }, {} as Record<string, Observable<PatientProfile>>)
        ).pipe(
          map(profilesById => appointments.map(appt => ({
            ...appt,
            patientFirstName: profilesById[String(appt.patientId)]?.firstName || (appt as any).patientFirstName || '',
            patientLastName:  profilesById[String(appt.patientId)]?.lastName  || (appt as any).patientLastName  || '',
            patientEmail:     profilesById[String(appt.patientId)]?.email     || appt.patientEmail || '',
          })))
        );
      }),
      takeUntil(this.destroy$),
      finalize(() => {
        this.loadingAppointments.set(false);
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: appointments => {
        this.appointments.set(appointments);
        this.cdr.detectChanges();
      },
      error: err => {
        this.errorAppointments.set(err?.error?.message ?? 'Impossible de charger les rendez-vous.');
        this.appointments.set([]);
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private afterConsultationSaved(consultation: Consultation): void {
    this.consultationDialogVisible.set(false);
    this.messageService.add({ severity: 'success', summary: 'Consultation enregistrée', detail: 'Ajoutée au dossier médical.' });

    const current = this.medicalFile();
    if (current && String(current.patientId) === String(consultation.patientId)) {
      // Medical file was already loaded — append directly (no extra API call)
      this.medicalFile.set(this.withSortedConsultations({
        ...current,
        consultations: [consultation, ...current.consultations],
        updatedAt: new Date().toISOString(),
      }));
    } else {
      const patient = this.selectedPatient();
      if (patient) {
        this.medicalFileService
          .getByPatientId(String(patient.id))
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: file => this.medicalFile.set(this.withSortedConsultations(file)),
            error: () => {} // silent — the dossier tab will retry on navigation
          });
      }
    }
  }

  private replaceAppointment(updated: Appointment): void {
    this.appointments.update(list => list.map(a => a.id === updated.id ? updated : a));
  }

  private toAppointmentIdentity(appointment: Appointment): Partial<AppointmentRequest> {
    const patient = this.patients().find(p => String(p.id) === String(appointment.patientId));
    return {
      patientId:        String(appointment.patientId),
      doctorId:         appointment.doctorId,
      dateTime:         appointment.dateTime,
      patientEmail:     patient?.email     ?? appointment.patientEmail,
      patientFirstName: patient?.firstName ?? appointment.patientFirstName,
    };
  }

  private withSortedConsultations(file: MedicalFile): MedicalFile {
    return {
      ...file,
      consultations: [...(file.consultations ?? [])].sort(
        (a, b) => new Date(b.dateDeConsultation).getTime() - new Date(a.dateDeConsultation).getTime(),
      ),
    };
  }

  private isInRange(value: Date, start: Date, range: MonitorRange): boolean {
    const day   = this.startOfDay(value).getTime();
    const begin = this.startOfDay(start).getTime();
    if (range === 'day') return day === begin;
    if (range === 'week') {
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return day >= begin && day < end.getTime();
    }
    return value.getFullYear() === start.getFullYear() && value.getMonth() === start.getMonth();
  }

  private startOfDay(value: Date): Date {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private toDateOnly(value: Date): string {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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

  private loadDarkMode(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.isDark = localStorage.getItem('cardiosense-dark') === 'true';
      document.body.classList.toggle('dark-mode', this.isDark);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Form builder
  // ─────────────────────────────────────────────────────────────────────────

  private buildForms(): void {
    // Typed nonNullable form – controls are accessed via .controls.X directly
    const nnfb = this.fb.nonNullable;
    this.appointmentForm = nnfb.group({
      patientId:       nnfb.control('',            Validators.required),
      date:            nnfb.control(new Date(),   Validators.required),
      selectedSlot:    nnfb.control('',            Validators.required),
      appointmentType: nnfb.control('CONSULTATION', Validators.required),
    });

    this.consultationForm = this.fb.group({
      diagnosis: ['', Validators.required],
      notes:     ['', Validators.required],
    });

    this.addPatientForm = this.fb.group({
      firstName:   ['', Validators.required],
      lastName:    ['', Validators.required],
      email:       ['', [Validators.required, Validators.email]],
      dateOfBirth: [null, Validators.required],
      gender:      ['', Validators.required],
      age:          [null, [Validators.required, Validators.min(0)]],
    });

    this.editPatientForm = this.fb.group({
      id:          [''],
  firstName:   ['', Validators.required],
  lastName:    ['', Validators.required],
  email:       ['', [Validators.required, Validators.email]],
  dateOfBirth: ['', Validators.required],
  gender:      ['', Validators.required],
  age:         [null, [Validators.required, Validators.min(0)]],
    });

    this.changePasswordForm = this.fb.group(
      {
        currentPassword: ['', Validators.required],
        newPassword:     ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: this.passwordsMatch },
    );

    this.predictionForm = this.fb.group({
      age:              [45,    [Validators.required, Validators.min(1),   Validators.max(120)]],
      sex:              [1,      Validators.required],
      chestPainType:    [0,      Validators.required],
      restingBP:        [120,   [Validators.required, Validators.min(50),  Validators.max(250)]],
      cholesterol:      [200,   [Validators.required, Validators.min(100), Validators.max(600)]],
      fastingBS:        [false,  Validators.required],
      restingECG:       [0,      Validators.required],
      maxHR:            [150,   [Validators.required, Validators.min(60),  Validators.max(220)]],
      exerciseAngina:   [false,  Validators.required],
      oldpeak:          [0,     [Validators.required, Validators.min(0)]],
      slope:            [1,      Validators.required],
      nbOfMajorVessels: [0,     [Validators.required, Validators.min(0), Validators.max(4)]],
      thalassemia:      [1,     [Validators.required, Validators.min(0), Validators.max(3)]],
    });

    this.updateDoctorForm = this.fb.group({
      id:          [''],
      firstName:   ['', Validators.required],
      lastName:    ['', Validators.required],
      email:       ['', [Validators.required, Validators.email]],
      numeroRPPS:  [{ value: '', disabled: true }],
    });

    this.availabilityForm = this.fb.group({
      dayOfWeek: ['MONDAY', Validators.required],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
    });
  }

  private passwordsMatch(group: FormGroup): { [key: string]: boolean } | null {
    const np = group.get('newPassword')?.value;
    const cp = group.get('confirmPassword')?.value;
    return np && cp && np !== cp ? { mismatch: true } : null;
  }
}