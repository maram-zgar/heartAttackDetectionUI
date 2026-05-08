// admin-dashboard.component.ts
import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, signal, computed, ChangeDetectorRef, inject } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError, finalize, take, filter } from 'rxjs/operators';
import { AdminService, Doctor, AppStats, ActivityEntry } from '../../core/http/admin.service';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, Header, MessageService } from 'primeng/api';
import { PasswordModule } from 'primeng/password';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { ChipModule } from 'primeng/chip';
import { BadgeModule } from 'primeng/badge';
import { FormsModule } from '@angular/forms';
import { TitleFromIdPipe } from './dashboard.pipes';
import { rehydrateAuth } from '../../store/auth/auth.actions';
import { selectAccessToken } from '../../store/auth/auth.selectors';

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  styleUrl: './admin-dashboard.component.scss',
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TagModule,
    AvatarModule,
    TooltipModule,
    ConfirmDialogModule,
    ToastModule,
    PasswordModule,
    DialogModule,
    SkeletonModule,
    ChipModule,
    BadgeModule,
    FormsModule,
    TitleFromIdPipe,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
    private readonly cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  // ── UI state ───────────────────────────────────────────────────────────────

  /** Whether the sidebar is in icon-only (collapsed) mode */
  sidebarCollapsed = signal(false);
  /** Whether the slide-in settings panel is open */
  settingsPanelOpen = signal(false);
  /** Currently active navigation page */
  activeNav = signal('dashboard');
  /** Dark mode state (synced with localStorage) */
  isDark = false;
  /** Visibility of the "Create Doctor" dialog */
  createDoctorVisible = false;

  // ── Loading flags ──────────────────────────────────────────────────────────

  loadingDoctors = signal(true);
  loadingStats = signal(true);
  loadingActivity = signal(true);
  submittingDoctor = signal(false);
  deletingDoctorId = signal<number | null>(null);

  // ── Data signals ──────────────────────────────────────────────────────────

  doctors = signal<Doctor[]>([]);
  stats = signal<AppStats>({
    totalDoctors: 0,
    totalPatients: 0,
    totalConsultations: 0,
    activeToday: 0,
  });
  activity = signal<ActivityEntry[]>([]);

  /** Filtered/sorted doctor list for the Médecins page */
  doctorSearch = '';
  get filteredDoctors(): Doctor[] {
    const q = this.doctorSearch.toLowerCase();
    return this.doctors().filter((d) =>
      `${d.firstName} ${d.lastName} ${d.email} `.toLowerCase().includes(q),
    );
  }

  // ── Forms ──────────────────────────────────────────────────────────────────

  createDoctorForm!: FormGroup;
  settingsForm!: FormGroup;

  // ── Static data ────────────────────────────────────────────────────────────

  readonly navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: 'pi-home' },
    { id: 'doctors', label: 'Médecins', icon: 'pi-users' },
    { id: 'stats', label: 'Statistiques', icon: 'pi-chart-bar' },
    { id: 'activity', label: 'Activité', icon: 'pi-history' },
  ];

  /** Icon and color for each activity type */
  readonly activityMeta: Record<string, { icon: string; color: string }> = {
    doctor_created: { icon: 'pi-user-plus', color: 'emerald' },
    patient_registered: { icon: 'pi-heart', color: 'amber' },
    consultation_completed: { icon: 'pi-file-edit', color: 'blue' },
    account_deactivated: { icon: 'pi-trash', color: 'rose' },
  };

  private readonly destroy$ = new Subject<void>();

  // ── Constructor ────────────────────────────────────────────────────────────

  constructor(
    private readonly fb: FormBuilder,
    private readonly adminService: AdminService,
    private readonly confirmationService: ConfirmationService,
    private readonly messageService: MessageService,
    //private readonly store: Store,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  private store = inject(Store);
  ngOnInit(): void {
    this.store.select(selectAccessToken).pipe(
      filter(token => !!token),
      take(1)
    ).subscribe(() => {
      this.loadAllData();
      this.buildForms();
      this.loadDarkMode();
    });
    
    
    
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Form builders ──────────────────────────────────────────────────────────

  private buildForms(): void {
    this.createDoctorForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      numeroRPPS: ['', Validators.required],
      hospital: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });

    this.settingsForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      email: ['admin@cardiosense.com'],
    });
  }

  // ── Dark mode ──────────────────────────────────────────────────────────────

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

  // ── Sidebar / nav ──────────────────────────────────────────────────────────

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }
  toggleSettings(): void {
    this.settingsPanelOpen.update((v) => !v);
  }
  setNav(id: string): void {
    this.activeNav.set(id);
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  /**
   * Fires all three API calls in parallel on init.
   * Each request has its own error handler so one failure doesn't block others.
   */
  private loadAllData(): void {
    //this.fetchStats();
    this.fetchDoctors();
    //this.fetchActivity();
  }

  /**
   * Fetch global platform statistics from the service.
   * Falls back to zeros on error so the UI never breaks.
   */
  fetchStats(): void {
    this.loadingStats.set(true);
    this.adminService
      .getStats()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingStats.set(false)),
      )
      .subscribe((data) => this.stats.set(data));
  }

  /**
   * Fetch the list of all registered doctor accounts from the service.
   * Falls back to an empty list on error.
   */

  fetchDoctors(): void {
    this.loadingDoctors.set(true);
    console.log('fetchDoctors started, loading:', this.loadingDoctors());
    this.adminService
      .getDoctors()
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          console.error('catchError hit:', err.status, err.error);
          return of<Doctor[]>([]);
        }),
        finalize(() => {
          console.log('finalize hit');
          this.loadingDoctors.set(false);
          console.log('loading after set:', this.loadingDoctors());
        }),
      )
      .subscribe((data) => {
        console.log('subscribe next, data length:', data.length);
        this.doctors.set(data);
        this.cdr.detectChanges();
      });
  }

  /**
   * Fetch the recent platform event log from the service.
   * Falls back to an empty list on error.
   */
  fetchActivity(): void {
    this.loadingActivity.set(true);
    this.adminService
      .getActivity()
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of<ActivityEntry[]>([])),
        finalize(() => this.loadingActivity.set(false)),
      )
      .subscribe((data) => {
        this.activity.set(data);
        this.cdr.detectChanges();
      });
  }

  /**
   * Creates a new doctor account via the service and refreshes the list.
   */
  submitCreateDoctor(): void {
    if (this.createDoctorForm.invalid) {
      this.createDoctorForm.markAllAsTouched();
      return;
    }
    const { password, ...rest } = this.createDoctorForm.value;
    const payload = { ...rest, initialPassword: password };

    this.submittingDoctor.set(true);
    this.adminService
      .createDoctor(payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.submittingDoctor.set(false)),
      )
      .subscribe({
        next: (created) => {
          this.doctors.update((list) => [...list, created]);
          this.messageService.add({
            severity: 'success',
            summary: 'Médecin créé',
            detail: `Dr. ${created.firstName} ${created.lastName} a bien été ajouté.`,
          });
          this.createDoctorVisible = false;
          this.createDoctorForm.reset();
          this.fetchDoctors();
          this.cdr.detectChanges();
        },
        error: (err) => {
          const detail = err?.error?.message ?? 'Impossible de créer le compte médecin.';
          this.messageService.add({ severity: 'error', summary: 'Erreur', detail });
          this.cdr.detectChanges();
        },
      });
  }

  /**
   * Shows a confirmation dialog before removing a doctor via the service.
   */
  confirmDelete(doctor: Doctor): void {
    this.confirmationService.confirm({
      message: `Supprimer le Dr. ${doctor.firstName} ${doctor.lastName} ? Cette action est irréversible.`,
      header: 'Confirmer la suppression',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.deletingDoctorId.set(doctor.id);
        this.adminService
          .deleteDoctor(doctor.id)
          .pipe(
            takeUntil(this.destroy$),
            finalize(() => this.deletingDoctorId.set(null)),
          )
          .subscribe({
            next: () => {
              this.doctors.update((list) => list.filter((d) => d.id !== doctor.id));
              this.messageService.add({
                severity: 'success',
                summary: 'Supprimé',
                detail: 'Le médecin a été retiré de la plateforme.',
              });
              this.cdr.detectChanges();
            },
            error: () => {
              this.messageService.add({
                severity: 'error',
                summary: 'Erreur',
                detail: 'La suppression a échoué. Réessayez.',
              });
              this.cdr.detectChanges();
            },
          });
      },
    });
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  /**
   * POST /admin/account/password (or your actual endpoint)
   * Saves the new password for the admin account.
   */
  saveSettings(): void {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      return;
    }
    // TODO: replace with real endpoint when backend exposes it
    // this.http.post('/api/v1/auth/change-password', this.settingsForm.value).subscribe(...)
    this.messageService.add({
      severity: 'success',
      summary: 'Sauvegardé',
      detail: 'Paramètres mis à jour.',
    });
    this.settingsPanelOpen.set(false);
  }

  // ── Utility helpers ────────────────────────────────────────────────────────

  /** Returns two-letter initials for a doctor's avatar */
  getInitials(doc: Doctor): string {
    return `${doc.firstName[0]}${doc.lastName[0]}`.toUpperCase();
  }

  /** Returns true when a form control is invalid AND has been touched */
  isFieldInvalid(form: FormGroup, field: string): boolean {
    const ctrl = form.get(field);
    return !!(ctrl && ctrl.invalid && ctrl.touched);
  }

  /** Returns icon + color metadata for an activity entry type */
  getActivityMeta(type: string): { icon: string; color: string } {
    return this.activityMeta[type] ?? { icon: 'pi-info-circle', color: 'blue' };
  }

  /**
   * Formats an ISO timestamp into a human-readable relative label.
   * e.g. "Il y a 2h", "Hier", "Il y a 3 jours"
   */
  formatRelativeTime(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);

    if (mins < 60) return `Il y a ${mins}min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days === 1) return 'Hier';
    return `Il y a ${days} jours`;
  }

  /** Quick stat: number of active doctors in the loaded list */
  get activeDoctorCount(): number {
    return this.doctors().length;
  }

  // testUploadImage(event: any): void {
  //  const formData = new FormData();
  //  formData.append('file', event.files[0], event.files[0].name);
  //}
}
