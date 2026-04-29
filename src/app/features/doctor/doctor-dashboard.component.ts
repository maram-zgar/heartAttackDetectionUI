import {
  Component, OnInit, OnDestroy, inject, PLATFORM_ID, Inject, signal, computed
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

import { DoctorService, Patient, Appointment, ConsultationComplete } from '../../core/http/doctor.service';
import { selectCurrentUser } from '../../store/auth/auth.selectors';
import { TitleFromIdPipe } from '../../pipes/title-from-id-pipe';

type NavSection = 'overview' | 'patients' | 'appointments' | 'prediction';

@Component({
  selector: 'app-doctor-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink,
    ButtonModule, AvatarModule, BadgeModule, TooltipModule,
    SkeletonModule, TagModule, DialogModule, TextareaModule,
    InputTextModule, ToastModule, ConfirmDialogModule,
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
  private fb = inject(FormBuilder);
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

  // ── Data Signals ───────────────────────────────────────────────
  patients = signal<Patient[]>([]);
  appointments = signal<Appointment[]>([]);
  errorPatients = signal<string | null>(null);
  errorAppointments = signal<string | null>(null);

  // ── Computed Stats ────────────────────────────────────────────
  totalPatients = computed(() => this.patients().length);
  criticalPatients = computed(() => this.patients().filter(p => p.status === 'critical').length);
  todayAppointments = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.appointments().filter(a => a.date?.startsWith(today)).length;
  });
  pendingAppointments = computed(() => this.appointments().filter(a => a.status === 'scheduled').length);
  completedToday = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.appointments().filter(a => a.date?.startsWith(today) && a.status === 'completed').length;
  });

  // List of today's appointments for template use (avoids new Date() in template)
  todayAppointmentsList = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.appointments().filter(a => a.date?.startsWith(today)).slice(0, 5);
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

  // ── Prediction State ───────────────────────────────────────────
  predictionForm!: FormGroup;
  predictionResult = signal<{ prediction: number; probability?: number } | null>(null);
  predictionLoading = signal(false);
  predictionError = signal<string | null>(null);

  // ── Navigation Items ───────────────────────────────────────────
  readonly navItems = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: 'pi-home' },
    { id: 'patients', label: 'Patients', icon: 'pi-users' },
    { id: 'appointments', label: 'Rendez-vous', icon: 'pi-calendar' },
    { id: 'prediction', label: 'Prédiction IA', icon: 'pi-chart-bar' }
  ];

  ngOnInit(): void {
    this.buildForm();
    if (isPlatformBrowser(this.platformId)) {
      this.loadDarkMode();
    }

    // Populate doctor name from store
    this.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      if (user) {
        this.doctorName.set(`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'Médecin');
        this.doctorEmail.set(user.email ?? '');
        this.doctorInitials.set(this.buildInitials(user.firstName, user.lastName, user.email));
      }
    });

    // Also try decoding from localStorage JWT if store user is null
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('access_token');
      if (token && !this.doctorEmail()) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          this.doctorEmail.set(payload.sub ?? '');
          this.doctorInitials.set(this.buildInitials(undefined, undefined, this.doctorEmail()));
          this.doctorName.set(this.doctorEmail());
        } catch { /* ignore */ }
      }
    }

    this.loadAllData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Form builder ───────────────────────────────────────────────
  private buildForm(): void {
    this.consultationForm = this.fb.group({
      appointmentId: [0],
      notes: ['', Validators.required],
      diagnosis: [''],
      nextAppointment: ['']
    });

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
  }

  // ── Data loading ───────────────────────────────────────────────

  loadAllData(): void {
    this.loadPatients();
    this.loadAppointments();
  }

  loadPatients(): void {
    this.loadingPatients.set(true);
    this.errorPatients.set(null);
    this.doctorService.getPatients().pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        this.errorPatients.set(err?.error?.message ?? 'Impossible de charger les patients.');
        return of([]);
      }),
      finalize(() => {
        this.loadingPatients.set(false);
      })
    ).subscribe(patients => {
      this.patients.set(patients);
    });
  }

  loadAppointments(): void {
    this.loadingAppointments.set(true);
    this.errorAppointments.set(null);
    this.doctorService.getAppointments().pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        this.errorAppointments.set(err?.error?.message ?? 'Impossible de charger les rendez-vous.');
        return of([]);
      }),
      finalize(() => {
        this.loadingAppointments.set(false);
      })
    ).subscribe(appointments => {
      this.appointments.set(appointments);
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
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        this.predictionResult.set(data);
        this.predictionLoading.set(false);
      })
      .catch(err => {
        this.predictionError.set(err?.message ?? 'Erreur de connexion au serveur de prédiction.');
        this.predictionLoading.set(false);
      });
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }

  toggleSettings(): void {
    this.settingsPanelOpen.update(v => !v);
  }

  // ── Dark mode ────────────────────────────────────────────────

  private loadDarkMode(): void {
    const saved = localStorage.getItem('cardiosense-dark');
    this.isDark = saved === 'true';
    this.applyDarkMode();
  }

  toggleDark(): void {
    this.isDark = !this.isDark;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cardiosense-dark', String(this.isDark));
      this.applyDarkMode();
    }
  }

  private applyDarkMode(): void {
    if (this.isDark) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
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
    this.doctorService.completeConsultation(formValue).pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'La soumission a échoué.',
        });
        return of(null);
      }),
      finalize(() => {
        this.submittingConsultation.set(false);
      })
    ).subscribe(result => {
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

  getStatusSeverity(status?: string): 'success' | 'danger' | 'warn' | 'info' | 'secondary' {
    switch (status) {
      case 'stable':     return 'success';
      case 'critical':   return 'danger';
      case 'monitoring': return 'warn';
      case 'discharged': return 'secondary';
      default:           return 'info';
    }
  }

  getStatusLabel(status?: string): string {
    switch (status) {
      case 'stable':     return 'Stable';
      case 'critical':   return 'Critique';
      case 'monitoring': return 'Surveillance';
      case 'discharged': return 'Sorti';
      default:           return 'Inconnu';
    }
  }

  getRiskLabel(risk?: string): string {
    switch (risk) {
      case 'low':    return 'Faible';
      case 'medium': return 'Moyen';
      case 'high':   return 'Élevé';
      default:       return '—';
    }
  }

  getAppointmentStatusLabel(status?: string): string {
    switch (status) {
      case 'scheduled':  return 'Planifié';
      case 'completed':  return 'Complété';
      case 'cancelled':  return 'Annulé';
      default:           return '—';
    }
  }

  getAppointmentStatusSeverity(status?: string): 'success' | 'danger' | 'warn' | 'info' | 'secondary' {
    switch (status) {
      case 'scheduled': return 'info';
      case 'completed': return 'success';
      case 'cancelled': return 'danger';
      default:          return 'secondary';
    }
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
}