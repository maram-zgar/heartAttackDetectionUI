import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  PLATFORM_ID,
  signal,
  computed,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { takeUntil, finalize, filter } from 'rxjs/operators';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { Skeleton } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { PasswordModule } from 'primeng/password';
import { TimelineModule } from 'primeng/timeline';
import { DrawerModule } from 'primeng/drawer';
import { TabsModule } from 'primeng/tabs';

// Services & models
import { AppointmentService } from '../../core/http/appointment.service';
import { MedicalFileService } from '../../core/http/medical-file.service';
import { AuthService } from '../../core/auth/auth.service';
import { selectCurrentUser } from '../../store/auth/auth.selectors';
import { Appointment, AppointmentRequest, MedicalFile } from '../../shared/models/medical.model';
import { UserProfile } from '../../shared/models/user-profile.model';
import { PatientBookingComponent } from '../patient/components/booking/patient-booking.component';
import { PatientService } from '../../core/http/patient.service';
import { DoctorService } from '../../core/http/doctor.service';



// ─────────────────────────────────────────────────────────────────────────────
//  Local types
// ─────────────────────────────────────────────────────────────────────────────

type NavSection = 'overview' | 'appointments' | 'medical-file' | 'settings' | 'booking';

interface SelectOption<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-patient-dashboard',
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
    PasswordModule,
    Skeleton,
    DrawerModule,
    TimelineModule,
    PatientBookingComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './patient-dashboard.component.html',
  styleUrls: ['./patient-dashboard.component.scss'],
})
export class PatientDashboardComponent implements OnInit, OnDestroy {

  // ── DI ────────────────────────────────────────────────────────────────────
  private readonly store               = inject(Store);
  private readonly authService         = inject(AuthService);
  private readonly appointmentService  = inject(AppointmentService);
  private readonly medicalFileService  = inject(MedicalFileService);
  private readonly messageService      = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly fb                  = inject(FormBuilder);
  private readonly cdr                 = inject(ChangeDetectorRef);
  private readonly platformId          = inject(PLATFORM_ID);
  private readonly destroy$            = new Subject<void>();
  private readonly patientService = inject(PatientService);
  private readonly doctorService = inject(DoctorService);



  // ─────────────────────────────────────────────────────────────────────────
  //  Static options
  // ─────────────────────────────────────────────────────────────────────────

  readonly navItems: { id: NavSection; label: string; icon: string }[] = [
    { id: 'overview',      label: "Vue d'ensemble",  icon: 'pi-home' },
    { id: 'appointments',  label: 'Mes Rendez-vous', icon: 'pi-calendar' },
    { id: 'medical-file',  label: 'Dossier Médical', icon: 'pi-folder-open' },
    { id: 'settings',      label: 'Paramètres',      icon: 'pi-cog' },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  //  Signals – loading
  // ─────────────────────────────────────────────────────────────────────────

  readonly loadingAppointments    = signal(false);
  readonly loadingMedicalFile     = signal(false);
  readonly loadingSlots           = signal(false);
  readonly submittingAppointment  = signal(false);
  readonly submittingPassword     = signal(false);
  readonly assignedDoctor = signal<{ firstName: string; lastName: string } | null>(null);
  readonly loadingDoctor  = signal(false);

  // ─────────────────────────────────────────────────────────────────────────
  //  Signals – data
  // ─────────────────────────────────────────────────────────────────────────

  readonly currentUser      = signal<UserProfile | null>(null);
  readonly appointments     = signal<Appointment[]>([]);
  readonly medicalFile      = signal<MedicalFile | null>(null);
  readonly availableSlots   = signal<string[]>([]);

  readonly patientName     = signal('Patient');
  readonly patientEmail    = signal('');
  readonly patientInitials = signal('PT');

  // Derive doctorId straight from profile
  readonly selectedDoctorId    = computed(() => this.currentUser()?.doctorId ?? '');
  readonly selectedDoctorFirst = computed(() => '');
  readonly selectedDoctorLast  = computed(() => '');

  // ─────────────────────────────────────────────────────────────────────────
  //  Signals – UI
  // ─────────────────────────────────────────────────────────────────────────

  readonly activeNav               = signal<NavSection>('overview');
  readonly sidebarCollapsed        = signal(false);
  readonly bookingDialogVisible    = signal(false);
  readonly rescheduleDialogVisible = signal(false);
  readonly settingsPanelOpen       = signal(false);
  readonly selectedAppointment     = signal<Appointment | null>(null);
  

  isDark = false;


  // ─────────────────────────────────────────────────────────────────────────
  //  Computed
  // ─────────────────────────────────────────────────────────────────────────

  readonly pendingAppointments = computed(() =>
    this.appointments().filter(a => a.status === 'PENDING'),
  );

  readonly confirmedAppointments = computed(() =>
    this.appointments().filter(a => a.status === 'CONFIRMED'),
  );

  readonly completedAppointments = computed(() =>
    this.appointments().filter(a => a.status === 'COMPLETED'),
  );

  readonly cancelledAppointments = computed(() =>
    this.appointments().filter(a => a.status === 'CANCELLED'),
  );

  readonly upcomingAppointments = computed(() =>
    this.appointments()
      .filter(a => a.status === 'CONFIRMED' || a.status === 'PENDING')
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
      .slice(0, 3),
  );

  readonly slotOptions = computed<SelectOption<string>[]>(() =>
    this.availableSlots().map(slot => ({
      label: slot.substring(11, 16),
      value: slot,
    })),
  );

  readonly recentConsultations = computed(() => {
    const file = this.medicalFile();
    if (!file) return [];
    return [...file.consultations]
      .sort((a, b) => new Date(b.dateDeConsultation).getTime() - new Date(a.dateDeConsultation).getTime())
      .slice(0, 5);
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  Forms
  // ─────────────────────────────────────────────────────────────────────────

  bookingForm!:         FormGroup;
  rescheduleForm!:      FormGroup;
  changePasswordForm!:  FormGroup;
  today = new Date();
  // ─────────────────────────────────────────────────────────────────────────
  //  LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.buildForms();

    if (isPlatformBrowser(this.platformId)) {
      this.loadDarkMode();
    }

    // Load profile from auth service (same pattern as doctor dashboard)
    this.loadPatientProfile();

    // Also listen to NgRx store for token-derived user
    this.store.select(selectCurrentUser).pipe(
      filter(user => !!user),
      takeUntil(this.destroy$),
    ).subscribe(user => {
      if (!this.currentUser()) {
        this.currentUser.set(user);
        this.patientEmail.set(user.email);
        this.patientName.set(`${user.firstName} ${user.lastName}`);
        this.patientInitials.set(this.buildInitials(user.firstName, user.lastName));
        this.loadAllData();
      }
      if (user?.doctorId) {
        this.loadAssignedDoctor(user.doctorId);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Data loading
  // ─────────────────────────────────────────────────────────────────────────

  loadPatientProfile(): void {
    this.authService.getUserProfile().pipe(takeUntil(this.destroy$)).subscribe({
      next: profile => {
        this.currentUser.set(profile as unknown as UserProfile);
        this.patientName.set(`${profile.firstName} ${profile.lastName}`);
        this.patientEmail.set(profile.email);
        this.patientInitials.set(this.buildInitials(profile.firstName, profile.lastName));
        this.loadAllData();
        if ((profile as any).doctorId) {
          this.loadAssignedDoctor((profile as any).doctorId);
        }
      },
      error: () => {
        // Silently fall back to NgRx store value
      },
    });
  }

  loadAllData(): void {
    this.loadAppointments();
    this.loadMedicalFile();
  }

  loadAppointments(): void {
    const patientId = this.currentUser()?.id;
    if (!patientId) return;

    this.loadingAppointments.set(true);
    // Reuse appointmentService.findAll() and filter by patientId client-side
    // (same approach as doctor dashboard for consistency)
    this.appointmentService.findAll().pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.loadingAppointments.set(false);
        this.cdr.detectChanges();
      }),
    ).subscribe({
      next: all => {
        // Keep only this patient's appointments
        this.appointments.set(
          all.filter(a => String(a.patientId) === String(patientId)),
        );
      },
      error: () => {
        this.appointments.set([]);
        this.showError('Impossible de charger vos rendez-vous.');
      },
    });
  }

  loadMedicalFile(): void {
    const patientId = this.currentUser()?.id;
    if (!patientId) return;

    this.loadingMedicalFile.set(true);
    this.medicalFileService.getByPatientId(String(patientId)).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.loadingMedicalFile.set(false);
        this.cdr.detectChanges();
      }),
    ).subscribe({
      next: file => this.medicalFile.set(this.withSortedConsultations(file)),
      error: () => {
        // Not an error — patient may have no file yet
        this.medicalFile.set(null);
      },
    });
  }

  private loadAssignedDoctor(doctorId: string): void {
    this.loadingDoctor.set(true);
    this.doctorService.getDoctorById(doctorId)
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingDoctor.set(false)))
      .subscribe({
        next: (doc: { firstName: string; lastName: string }) => this.assignedDoctor.set(doc),
        error: ()  => this.assignedDoctor.set(null),
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Appointment booking
  // ─────────────────────────────────────────────────────────────────────────

  openBookingDialog(): void {
    this.navigateTo('booking');
  }

  checkSlots(): void {
    const doctorId = this.bookingForm.get('doctorId')?.value;
    const date = this.bookingForm.get('date')?.value;
    if (!doctorId || !date) return;

    // Clear slot selection when reloading
    this.bookingForm.get('selectedSlot')?.setValue('');
    this.availableSlots.set([]);

    this.loadingSlots.set(true);
    this.appointmentService
      .getAvailableSlots(doctorId, this.toDateOnly(date))
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingSlots.set(false)))
      .subscribe({
        next:  r  => this.availableSlots.set(r.slots),
        error: () => {
          this.availableSlots.set([]);
          this.showError('Aucun créneau disponible pour cette date.');
        },
      });
  }

  submitBooking(): void {
    if (this.bookingForm.invalid || !this.currentUser()) {
      this.bookingForm.markAllAsTouched();
      return;
    }

    const patient = this.currentUser()!;
    const { doctorId, selectedSlot } = this.bookingForm.value;

    if (!selectedSlot) {
      this.showError('Veuillez sélectionner un créneau horaire.');
      return;
    }

    const request: AppointmentRequest = {
      patientId:        String(patient.id),
      doctorId,
      // selectedSlot is already the full ISO datetime from the backend
      dateTime:         selectedSlot,
      patientEmail:     patient.email,
      patientFirstName: patient.firstName,
      patientLastName:  patient.lastName,
    };

    this.submittingAppointment.set(true);
    this.appointmentService.create(request).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.submittingAppointment.set(false)),
    ).subscribe({
      next: appt => {
        this.appointments.update(list => [appt, ...list]);
        this.bookingDialogVisible.set(false);
        this.messageService.add({
          severity: 'success',
          summary:  'Demande envoyée',
          detail:   'Votre rendez-vous est en attente de confirmation.',
        });
      },
      error: (err: unknown) => this.showError(this.errorMessage(err)),
    });
  }

  openRescheduleDialog(appointment: Appointment): void {
    this.selectedAppointment.set(appointment);
    this.rescheduleForm.reset({
      doctorId:     appointment.doctorId,
      date:         new Date(appointment.dateTime),
      selectedSlot: '',
    });
    this.availableSlots.set([]);
    this.rescheduleDialogVisible.set(true);
    this.checkRescheduleSlots();
  }

  checkRescheduleSlots(): void {
    const doctorId = this.rescheduleForm.get('doctorId')?.value;
    const date     = this.rescheduleForm.get('date')?.value;
    if (!doctorId || !date) return;

    this.rescheduleForm.get('selectedSlot')?.setValue('');
    this.availableSlots.set([]);
    this.loadingSlots.set(true);
    this.appointmentService
      .getAvailableSlots(doctorId, this.toDateOnly(date))
      .pipe(takeUntil(this.destroy$), finalize(() => this.loadingSlots.set(false)))
      .subscribe({
        next: r => this.availableSlots.set(r.slots),
        error: () => this.availableSlots.set([]),
      });
  }

  submitReschedule(): void {
    const appointment = this.selectedAppointment();
    const patient = this.currentUser();
    if (!appointment || !patient || this.rescheduleForm.invalid) {
      this.rescheduleForm.markAllAsTouched();
      return;
    }

    const selectedSlot = this.rescheduleForm.get('selectedSlot')?.value;
    if (!selectedSlot) {
      this.showError('Veuillez sélectionner un nouveau créneau.');
      return;
    }

    const request: AppointmentRequest = {
      patientId: String(patient.id),
      doctorId: appointment.doctorId,
      dateTime: selectedSlot,
      status: 'PENDING',
      patientEmail: patient.email,
      patientFirstName: patient.firstName,
      patientLastName: patient.lastName,
      durationMinutes: appointment.durationMinutes,
      appointmentType: appointment.appointmentType,
    };

    this.submittingAppointment.set(true);
    this.appointmentService.reschedule(appointment.id, request).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.submittingAppointment.set(false)),
    ).subscribe({
      next: updated => {
        this.appointments.update(list => list.map(a => a.id === updated.id ? updated : a));
        this.rescheduleDialogVisible.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Demande de reprogrammation envoyée',
          detail: 'Le médecin devra valider le nouveau créneau.',
        });
        this.loadAppointments();
      },
      error: (err: unknown) => this.showError(this.errorMessage(err)),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Settings – change password
  // ─────────────────────────────────────────────────────────────────────────

  submitChangePassword(): void {
    if (this.changePasswordForm.invalid) { this.changePasswordForm.markAllAsTouched(); return; }

    this.submittingPassword.set(true);
    const { currentPassword, newPassword } = this.changePasswordForm.value;

    // Reuse the generic change-password endpoint (patients share the gateway auth)
    this.patientService.changePassword({ currentPassword, newPassword }).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.submittingPassword.set(false)),
    ).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary:  'Mot de passe modifié',
          detail:   'Votre mot de passe a été mis à jour.',
        });
        this.changePasswordForm.reset();
      },
      error: (err: unknown) => this.showError(this.errorMessage(err)),
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

  toggleSidebar(): void { this.sidebarCollapsed.update(v => !v); }
  toggleSettings(): void { this.settingsPanelOpen.update(v => !v); }

  toggleDark(): void {
    this.isDark = !this.isDark;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cardiosense-dark', String(this.isDark));
      document.body.classList.toggle('dark-mode', this.isDark);
    }
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/auth/authenticate';
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Display helpers
  // ─────────────────────────────────────────────────────────────────────────

  statusLabel(status: string | undefined): string {
    const map: Record<string, string> = {
      PENDING:   'En attente',
      CONFIRMED: 'Accepté',
      RESCHEDULED: 'Reprogrammé',
      CANCELLED: 'Annulé',
      COMPLETED: 'Terminé',
    };
    return status ? (map[status] ?? status) : 'Inconnu';
  }

  statusSeverity(status: string | undefined): 'success' | 'danger' | 'warn' | 'info' | 'secondary' {
    const map: Record<string, 'success' | 'danger' | 'warn' | 'info' | 'secondary'> = {
      PENDING:   'warn',
      CONFIRMED: 'success',
      RESCHEDULED: 'info',
      CANCELLED: 'danger',
      COMPLETED: 'secondary',
    };
    return status ? (map[status] ?? 'secondary') : 'secondary';
  }

  statusIcon(status: string | undefined): string {
    const map: Record<string, string> = {
      PENDING:   'pi pi-clock',
      CONFIRMED: 'pi pi-check-circle',
      RESCHEDULED: 'pi pi-calendar-clock',
      CANCELLED: 'pi pi-times-circle',
      COMPLETED: 'pi pi-check-square',
    };
    return status ? (map[status] ?? 'pi pi-circle') : 'pi pi-circle';
  }

  riskText(prediction: number | undefined): string {
    if (prediction === undefined || prediction === null) return '—';
    return prediction === 1 ? 'Risque élevé' : 'Risque faible';
  }

  riskSeverity(prediction: number | undefined): 'danger' | 'success' | 'secondary' {
    if (prediction === undefined || prediction === null) return 'secondary';
    return prediction === 1 ? 'danger' : 'success';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch { return dateStr; }
  }

  formatDateTime(dateStr?: string): string {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return dateStr; }
  }

  skeletonArray(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  isFieldInvalid(form: FormGroup, field: string): boolean {
    const ctrl = form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  buildInitials(first?: string, last?: string): string {
    if (first && last) return (first[0] + last[0]).toUpperCase();
    if (first) return first[0].toUpperCase();
    return 'PT';
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private withSortedConsultations(file: MedicalFile): MedicalFile {
    return {
      ...file,
      consultations: [...file.consultations].sort(
        (a, b) => new Date(b.dateDeConsultation).getTime() - new Date(a.dateDeConsultation).getTime(),
      ),
    };
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
    this.isDark = localStorage.getItem('cardiosense-dark') === 'true';
    document.body.classList.toggle('dark-mode', this.isDark);
  }

  private buildForms(): void {
    this.bookingForm = this.fb.group({
      doctorId:     ['', Validators.required],
      date:         [new Date(), Validators.required],
      selectedSlot: ['', Validators.required],
    });

    this.rescheduleForm = this.fb.group({
      doctorId:     ['', Validators.required],
      date:         [new Date(), Validators.required],
      selectedSlot: ['', Validators.required],
    });

    this.changePasswordForm = this.fb.group(
      {
        currentPassword: ['', Validators.required],
        newPassword:     ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: this.passwordsMatch },
    );
  }

  private passwordsMatch(group: FormGroup): { [key: string]: boolean } | null {
    const np = group.get('newPassword')?.value;
    const cp = group.get('confirmPassword')?.value;
    return np && cp && np !== cp ? { mismatch: true } : null;
  }
}
