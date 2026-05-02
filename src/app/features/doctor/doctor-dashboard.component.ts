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
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { takeUntil, catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

import {
  DoctorService,
  Patient,
  Appointment,
  ConsultationComplete,
} from '../../core/http/doctor.service';
import { selectCurrentUser } from '../../store/auth/auth.selectors';
import { TitleFromIdPipe } from '../../pipes/title-from-id-pipe';
import { AuthService } from '../../core/auth/auth.service';

type NavSection = 'overview' | 'patients' | 'appointments' | 'prediction';

@Component({
  selector: 'app-doctor-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    AvatarModule,
    BadgeModule,
    TooltipModule,
    SkeletonModule,
    TagModule,
    DialogModule,
    TextareaModule,
    InputTextModule,
    ToastModule,
    ConfirmDialogModule,
    TitleFromIdPipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './doctor-dashboard.component.html',
  styleUrls: ['./doctor-dashboard.component.scss'],
})
export class DoctorDashboardComponent implements OnInit, OnDestroy {
  private store = inject(Store);
  private router = inject(Router);
  private doctorService = inject(DoctorService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private fb = inject(FormBuilder);
  private readonly cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  @Inject(PLATFORM_ID) private platformId: object = inject(PLATFORM_ID);
  private destroy$ = new Subject<void>();

  // ── UI State ───────────────────────────────────────────────────
  sidebarCollapsed = signal(false);
  settingsPanelOpen = signal(false);
  activeNav = signal<NavSection>('overview');
  isDark = false;

  // ── Loading States ─────────────────────────────────────────────
  loadingPatients = signal(false);
  loadingAppointments = signal(false);
  submittingConsultation = signal(false);
  submittingAddPatient = signal(false);
  submittingChangePassword = signal(false);

  // ── Data Signals ───────────────────────────────────────────────
  patients = signal<Patient[]>([]);
  appointments = signal<Appointment[]>([]);
  errorPatients = signal<string | null>(null);
  errorAppointments = signal<string | null>(null);

  // ── Computed Stats ────────────────────────────────────────────
  totalPatients = computed(() => this.patients().length);
  criticalPatients = computed(() => this.patients().filter((p) => p.status === 'critical').length);
  todayAppointments = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.appointments().filter((a) => a.date?.startsWith(today)).length;
  });
  pendingAppointments = computed(
    () => this.appointments().filter((a) => a.status === 'scheduled').length,
  );
  completedToday = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.appointments().filter((a) => a.date?.startsWith(today) && a.status === 'completed')
      .length;
  });

  // ── Nouveaux signaux pour l'édition
  editPatientVisible = signal(false);
  submittingEditPatient = signal(false);
  editPatientForm!: FormGroup;
  selectedPatientForEdit = signal<Patient | null>(null);

  // ── List of today's appointments for template use (avoids new Date() in template)
  todayAppointmentsList = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.appointments()
      .filter((a) => a.date?.startsWith(today))
      .slice(0, 5);
  });

  // ── User Info ──────────────────────────────────────────────────
  currentUser$ = this.store.select(selectCurrentUser);
  doctorName = signal('Médecin');
  doctorEmail = signal('');
  doctorInitials = signal('MD');

  // ── Dialog States ──────────────────────────────────────────────
  consultationDialogVisible = signal(false);
  selectedPatient = signal<Patient | null>(null);
  consultationForm!: FormGroup;
  patientDetailVisible = signal(false);
  selectedPatientDetail = signal<Patient | null>(null);
  addPatientVisible = signal(false);
  addPatientForm!: FormGroup;

  // ── Prediction State ───────────────────────────────────────────
  predictionForm!: FormGroup;
  predictionResult = signal<{ prediction: number; probability?: number } | null>(null);
  predictionLoading = signal(false);
  predictionError = signal<string | null>(null);

  // ── Change Password (settings panel) ─────────────────────────────────────
  changePasswordForm!: FormGroup;

  // ── Navigation Items ───────────────────────────────────────────
  readonly navItems = [
    { id: 'overview', label: "Vue d'ensemble", icon: 'pi-home' },
    { id: 'patients', label: 'Patients', icon: 'pi-users' },
    { id: 'appointments', label: 'Rendez-vous', icon: 'pi-calendar' },
    { id: 'prediction', label: 'Prédiction IA', icon: 'pi-chart-bar' },
  ];

  // ── Profile forum ────────────────────────────────────────────────
  submittingUpdateDoctor = signal(false);
  updateDoctorForm!: FormGroup;

  private readonly authService = inject(AuthService);

  // ─────────────────────────────────────────────────────────────────────────
  //  LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.buildForm();
    if (isPlatformBrowser(this.platformId)) {
      this.loadDarkMode();
    }

    this.loadDoctorProfile();

    // Also try decoding from localStorage JWT if store user is null
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('access_token');
      if (token && !this.doctorEmail()) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          this.doctorEmail.set(payload.sub ?? '');
          this.doctorInitials.set(this.buildInitials(undefined, undefined, this.doctorEmail()));
          this.doctorName.set(this.doctorEmail());
        } catch {
          /* ignore */
        }
      }
    }

    //this.markDoctorActive();

    this.loadAllData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Form builder ───────────────────────────────────────────────
  private buildForm(): void {
    this.updateDoctorForm = this.fb.group({
      id: [''],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      hospital: [''],
      numeroRPPS: [{ value: '', disabled: true }],
    });

    this.consultationForm = this.fb.group({
      appointmentId: [0],
      notes: ['', Validators.required],
      diagnosis: [''],
      nextAppointment: [''],
    });

    this.addPatientForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      dateOfBirth: [''],
      address: [''],
    });

    this.changePasswordForm = this.fb.group(
      {
        currentPassword: ['', Validators.required],
        newPassword: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: this.passwordsMatch },
    );

    this.predictionForm = this.fb.group({
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

    this.editPatientForm = this.fb.group({
      id: [''], // Nécessaire pour l'updateBackend
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      dateOfBirth: [''],
      address: [''],
      hospital: [''],
    });
  }

  private passwordsMatch(group: FormGroup): { [key: string]: boolean } | null {
    const np = group.get('newPassword')?.value;
    const cp = group.get('confirmPassword')?.value;
    return np && cp && np !== cp ? { mismatch: true } : null;
  }

  // ── Data loading ───────────────────────────────────────────────

  loadAllData(): void {
    this.loadPatients();
    this.loadAppointments();
  }

  loadDoctorProfile(): void {
    this.authService
      .getUserProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profile) => {
          this.doctorName.set(`${profile.firstName} ${profile.lastName}`);
          this.doctorEmail.set(profile.email);
          this.doctorInitials.set(this.buildInitials(profile.firstName, profile.lastName));

          this.updateDoctorForm.patchValue({
            id: profile.id,
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
            hospital: profile.hospital,
            numeroRPPS: profile.numeroRPPS,
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Impossible de charger les informations du médecin.',
          });
        },
      });
  }

  loadPatients(): void {
    this.loadingPatients.set(true);
    this.errorPatients.set(null);

    this.doctorService
      .getPatients()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (patients) => {
          this.patients.set(patients);
          this.loadingPatients.set(false);
          this.cdr.detectChanges();
        },
        error: (err) => {
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

    this.doctorService
      .getAppointments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (appointments) => {
          this.appointments.set(appointments);
          this.loadingAppointments.set(false);
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.errorAppointments.set(
            err?.error?.message ?? 'Impossible de charger les rendez-vous.',
          );
          this.appointments.set([]);
          this.loadingAppointments.set(false);
          this.cdr.detectChanges();
        },
      });
  }

  // ── Submit Updates ──────────────────────────────────────────────────────────────────────

  submitUpdateDoctor(): void {
    if (this.updateDoctorForm.invalid) {
      this.updateDoctorForm.markAllAsTouched();
      return;
    }

    this.submittingUpdateDoctor.set(true);

    const payload = this.updateDoctorForm.getRawValue();

    this.doctorService
      .updateDoctor(payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.submittingUpdateDoctor.set(false)),
      )
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Profil mis à jour',
            detail: 'Modifications enregistrées',
          });

          // update UI instantly
          this.doctorName.set(`${payload.firstName} ${payload.lastName}`);
          this.doctorEmail.set(payload.email);
          this.doctorInitials.set(this.buildInitials(payload.firstName, payload.lastName));
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Échec de mise à jour',
          });
        },
      });
  }
  // ─────────────────────────────────────────────────────────────────────────
  //  STATUS — mark doctor active when they log in
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Calls PATCH /api/v1/doctors/me/status?active=true via the DoctorService.
   * This updates the doctor's `active` flag in the database so the admin
   * dashboard reflects "Actif" immediately after sign-in.
   * The call is fire-and-forget; failures are silently swallowed so they
   * never block dashboard initialization.
   */
  /**private markDoctorActive(): void {
    this.doctorService.markActive()
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of(null)),
      )
      .subscribe();
  }*/

  // ── Patient methods ────────────────────────────────────────────────
  openEditPatient(patient: Patient): void {
    this.selectedPatientForEdit.set(patient);
    this.editPatientForm.patchValue({
      ...patient,
    });
    this.editPatientVisible.set(true);
  }

  submitEditPatient(): void {
    if (this.editPatientForm.invalid) {
      this.editPatientForm.markAllAsTouched();
      return;
    }

    this.submittingEditPatient.set(true);

    const { id, ...data } = this.editPatientForm.value;

    this.doctorService
      .updatePatient(id, data)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.submittingEditPatient.set(false)),
      )
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Succès',
            detail: 'Patient mis à jour.',
          });
          this.editPatientVisible.set(false);
          this.loadPatients();
        },
        error: () =>
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Échec de la mise à jour.',
          }),
      });
  }

  confirmDeletePatient(patient: Patient): void {
    this.confirmationService.confirm({
      message: `Êtes-vous sûr de vouloir supprimer le patient ${patient.firstName} ${patient.lastName} ? Cette action est irréversible.`,
      header: 'Confirmation de suppression',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui, supprimer',
      rejectLabel: 'Annuler',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.doctorService
          .deletePatient(patient.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.messageService.add({
                severity: 'success',
                summary: 'Succès',
                detail: 'Patient supprimé.',
              });
              this.loadPatients(); // Rafraîchit la liste
            },
            error: () =>
              this.messageService.add({
                severity: 'error',
                summary: 'Erreur',
                detail: 'Impossible de supprimer ce patient.',
              }),
          });
      },
    });
  }

  // ── Navigation ────────────────────────────────────────────────

  navigateTo(section: NavSection): void {
    this.activeNav.set(section);
  }

  submitPrediction(): void {
    if (this.predictionForm.invalid) return;
    this.predictionLoading.set(true);
    this.predictionError.set(null);
    this.predictionResult.set(null);

    const body = this.predictionForm.value;
    fetch('http://127.0.0.1:8000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        this.predictionResult.set(data);
        this.predictionLoading.set(false);
      })
      .catch((err) => {
        this.predictionError.set(err?.message ?? 'Erreur de connexion au serveur de prédiction.');
        this.predictionLoading.set(false);
      });
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  toggleSettings(): void {
    this.settingsPanelOpen.update((v) => !v);
  }

  // ── Dark mode ────────────────────────────────────────────────

  private loadDarkMode(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.isDark = localStorage.getItem('cardiosense-dark') === 'true';
      document.body.classList.toggle('dark-mode', this.isDark);
    }
  }

  toggleDark(): void {
    this.isDark = !this.isDark;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cardiosense-dark', String(this.isDark));
      document.body.classList.toggle('dark-mode', this.isDark);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  ADD PATIENT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Opens the "Ajouter un patient" dialog and resets the form.
   */
  openAddPatient(): void {
    this.addPatientForm.reset();
    this.addPatientVisible.set(true);
  }

  /**
   * Submits the add-patient form.
   * The backend auto-creates a fully configured medical file (dossier médical)
   * for the new patient via POST /api/v1/patients.
   */
  submitAddPatient(): void {
    if (this.addPatientForm.invalid) {
      this.addPatientForm.markAllAsTouched();
      return;
    }

    this.submittingAddPatient.set(true);
    this.doctorService
      .createPatient(this.addPatientForm.value)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.submittingAddPatient.set(false)),
      )
      .subscribe({
        next: (created) => {
          this.patients.update((list) => [...list, created]);
          this.messageService.add({
            severity: 'success',
            summary: 'Patient ajouté',
            detail: `${created.firstName} ${created.lastName} a été enregistré et son dossier médical créé.`,
          });
          this.addPatientVisible.set(false);
          this.addPatientForm.reset();
          this.loadPatients(); // refresh from server
        },
        error: (err) => {
          const detail = err?.error?.message ?? "Impossible d'ajouter le patient.";
          this.messageService.add({ severity: 'error', summary: 'Erreur', detail });
        },
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  CHANGE PASSWORD
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Submits the change-password form via the doctor service.
   * Endpoint: POST /api/v1/auth/change-password
   */
  submitChangePassword(): void {
    if (this.changePasswordForm.invalid) {
      this.changePasswordForm.markAllAsTouched();
      return;
    }

    this.submittingChangePassword.set(true);
    const { currentPassword, newPassword } = this.changePasswordForm.value;

    this.doctorService
      .changePassword({ currentPassword, newPassword })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.submittingChangePassword.set(false)),
      )
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Mot de passe modifié',
            detail: 'Votre mot de passe a été mis à jour avec succès.',
          });
          this.changePasswordForm.reset();
          this.settingsPanelOpen.set(false);
        },
        error: (err) => {
          const detail = err?.error?.message ?? 'Échec de la modification du mot de passe.';
          this.messageService.add({ severity: 'error', summary: 'Erreur', detail });
        },
      });
  }

  // ── Patient actions ────────────────────────────────────────────

  openPatientDetail(patient: Patient): void {
    this.selectedPatientDetail.set(patient);
    this.patientDetailVisible.set(true);
  }

  openConsultationDialog(patient: Patient, appointmentId = 0): void {
    this.selectedPatient.set(patient);
    this.consultationForm.patchValue({ appointmentId, notes: '', diagnosis: '' });
    this.consultationDialogVisible.set(true);
  }

  submitConsultation(): void {
    if (!this.consultationForm.get('notes')?.value?.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Champ requis',
        detail: 'Veuillez ajouter des notes pour la consultation.',
      });
      return;
    }
    this.submittingConsultation.set(true);
    const formValue = this.consultationForm.value as ConsultationComplete;
    this.doctorService
      .completeConsultation(formValue)
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: err?.error?.message ?? 'La soumission a échoué.',
          });
          return of(null);
        }),
        finalize(() => {
          this.submittingConsultation.set(false);
        }),
      )
      .subscribe((result) => {
        if (result !== null) {
          this.messageService.add({
            severity: 'success',
            summary: 'Consultation complétée',
            detail: 'La consultation a été enregistrée avec succès.',
          });
          this.consultationDialogVisible.set(false);
          this.loadAppointments(); // refresh
        }
      });
  }

  // ── Helper methods ────────────────────────────────────────────

  buildInitials(first?: string, last?: string, email?: string): string {
    if (first && last) return (first[0] + last[0]).toUpperCase();
    if (first) return first[0].toUpperCase();
    if (email) return email[0].toUpperCase();
    return 'MD';
  }

  isFieldInvalid(form: FormGroup, field: string): boolean {
    const ctrl = form.get(field);
    return !!(ctrl && ctrl.invalid && ctrl.touched);
  }

  getStatusSeverity(status?: string): 'success' | 'danger' | 'warn' | 'info' | 'secondary' {
    switch (status) {
      case 'stable':
        return 'success';
      case 'critical':
        return 'danger';
      case 'monitoring':
        return 'warn';
      case 'discharged':
        return 'secondary';
      default:
        return 'info';
    }
  }

  getStatusLabel(status?: string): string {
    switch (status) {
      case 'stable':
        return 'Stable';
      case 'critical':
        return 'Critique';
      case 'monitoring':
        return 'Surveillance';
      case 'discharged':
        return 'Sorti';
      default:
        return 'Inconnu';
    }
  }

  getRiskLabel(risk?: string): string {
    switch (risk) {
      case 'low':
        return 'Faible';
      case 'medium':
        return 'Moyen';
      case 'high':
        return 'Élevé';
      default:
        return '—';
    }
  }

  getAppointmentStatusLabel(status?: string): string {
    switch (status) {
      case 'scheduled':
        return 'Planifié';
      case 'completed':
        return 'Complété';
      case 'cancelled':
        return 'Annulé';
      default:
        return '—';
    }
  }

  getAppointmentStatusSeverity(
    status?: string,
  ): 'success' | 'danger' | 'warn' | 'info' | 'secondary' {
    switch (status) {
      case 'scheduled':
        return 'info';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  skeletonArray(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }
}
