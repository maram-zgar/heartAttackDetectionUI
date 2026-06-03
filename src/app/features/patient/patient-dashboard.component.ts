// patient-dashboard.component.ts  — additions for doctor-picker flow
// Add these to the existing PatientDashboardComponent class
// (only the NEW/CHANGED parts shown — merge with existing file)

// ── Add to imports ─────────────────────────────────────────────────────────
// import { DoctorService } from '../../core/http/doctor.service';
// (already imported)

// ── Add these new signals inside the class ─────────────────────────────────

/*
  readonly allDoctors       = signal<any[]>([]);
  readonly loadingDoctors   = signal(false);
  readonly tempSelectedDoctor = signal<any | null>(null);

  readonly tempSelectedDoctorId    = computed(() => this.tempSelectedDoctor()?.id ?? '');
  readonly tempSelectedDoctorFirst = computed(() => this.tempSelectedDoctor()?.firstName ?? '');
  readonly tempSelectedDoctorLast  = computed(() => this.tempSelectedDoctor()?.lastName ?? '');
*/

// ── Add these new methods inside the class ────────────────────────────────

/*
  loadAllDoctors(): void {
    this.loadingDoctors.set(true);
    this.doctorService.getAllDoctors().pipe(
      takeUntil(this.destroy$),
      finalize(() => this.loadingDoctors.set(false)),
    ).subscribe({
      next: docs => this.allDoctors.set(docs),
      error: () => this.allDoctors.set([]),
    });
  }

  selectTempDoctor(doc: any): void {
    this.tempSelectedDoctor.set(doc);
  }

  onAppointmentBooked(): void {
    this.loadAppointments();
    // After booking, reload profile to pick up assigned doctorId
    this.loadPatientProfile();
  }

  // In navigateTo, add this case:
  // if (section === 'booking' && !this.selectedDoctorId()) {
  //   this.loadAllDoctors();
  // }
*/

// ════════════════════════════════════════════════════════════════════════════
// FULL COMPONENT — copy this file as patient-dashboard.component.ts
// ════════════════════════════════════════════════════════════════════════════

import {
  Component, OnInit, OnDestroy, inject, PLATFORM_ID,
  signal, computed, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { takeUntil, finalize, filter } from 'rxjs/operators';
import {
  FormsModule, ReactiveFormsModule,
  FormBuilder, FormGroup, Validators,
} from '@angular/forms';

import { TableModule }         from 'primeng/table';
import { ButtonModule }        from 'primeng/button';
import { AvatarModule }        from 'primeng/avatar';
import { BadgeModule }         from 'primeng/badge';
import { TooltipModule }       from 'primeng/tooltip';
import { Skeleton }            from 'primeng/skeleton';
import { TagModule }           from 'primeng/tag';
import { DialogModule }        from 'primeng/dialog';
import { InputTextModule }     from 'primeng/inputtext';
import { ToastModule }         from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DatePickerModule }    from 'primeng/datepicker';
import { SelectModule }        from 'primeng/select';
import { PasswordModule }      from 'primeng/password';
import { TimelineModule }      from 'primeng/timeline';
import { DrawerModule }        from 'primeng/drawer';
import { TabsModule }          from 'primeng/tabs';

import { AppointmentService }    from '../../core/http/appointment.service';
import { MedicalFileService }    from '../../core/http/medical-file.service';
import { AuthService }           from '../../core/auth/auth.service';
import { PatientService }        from '../../core/http/patient.service';
import { DoctorService }         from '../../core/http/doctor.service';
import { selectCurrentUser }     from '../../store/auth/auth.selectors';
import {
  Appointment, AppointmentRequest, MedicalFile,
} from '../../shared/models/medical.model';
import { UserProfile }           from '../../shared/models/user-profile.model';
import { PatientBookingComponent } from '../patient/components/booking/patient-booking.component';
import { ConsultationService, PatientConsultation } from '../../core/http/consultation.service';

type NavSection = 'overview' | 'appointments' | 'medical-file' | 'settings' | 'booking';
interface SelectOption<T> { label: string; value: T; }

@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    ButtonModule, AvatarModule, BadgeModule, TooltipModule,
    TagModule, TableModule, TabsModule, SelectModule, DatePickerModule,
    ToastModule, ConfirmDialogModule, DialogModule, InputTextModule,
    PasswordModule, Skeleton, DrawerModule, TimelineModule,
    PatientBookingComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './patient-dashboard.component.html',
  styleUrls:   ['./patient-dashboard.component.scss'],
})
export class PatientDashboardComponent implements OnInit, OnDestroy {

  hasHighRisk(c: PatientConsultation): boolean {
    return c.vitals?.some(v => v.risk_percentage != null && v.risk_percentage > 0.5) ?? false;
  }

  // ── DI ────────────────────────────────────────────────────────────────────
  private readonly store               = inject(Store);
  private readonly authService         = inject(AuthService);
  private readonly appointmentService  = inject(AppointmentService);
  private readonly medicalFileService  = inject(MedicalFileService);
  private readonly patientService      = inject(PatientService);
  private readonly doctorService       = inject(DoctorService);
  private readonly messageService      = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly fb                  = inject(FormBuilder);
  private readonly cdr                 = inject(ChangeDetectorRef);
  private readonly consultationService = inject(ConsultationService);
  private readonly platformId          = inject(PLATFORM_ID);
  private readonly destroy$            = new Subject<void>();

  // ── Nav ───────────────────────────────────────────────────────────────────
  readonly navItems: { id: NavSection; label: string; icon: string }[] = [
    { id: 'overview',     label: "Vue d'ensemble",  icon: 'pi-home'        },
    { id: 'appointments', label: 'Mes Rendez-vous', icon: 'pi-calendar'    },
    { id: 'medical-file', label: 'Dossier Médical', icon: 'pi-folder-open' },
    { id: 'settings',     label: 'Paramètres',      icon: 'pi-cog'         },
  ];

  // ── Loading ───────────────────────────────────────────────────────────────
  readonly loadingAppointments   = signal(false);
  readonly loadingMedicalFile    = signal(false);
  readonly loadingSlots          = signal(false);
  readonly submittingAppointment = signal(false);
  readonly submittingPassword    = signal(false);
  readonly loadingDoctor         = signal(false);
  readonly loadingDoctors        = signal(false);  // ← NEW
  readonly consultations         = signal<PatientConsultation[]>([]);
  readonly loadingConsultations  = signal(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  readonly currentUser    = signal<UserProfile | null>(null);
  readonly appointments   = signal<Appointment[]>([]);
  readonly medicalFile    = signal<MedicalFile | null>(null);
  readonly availableSlots = signal<string[]>([]);
  readonly allDoctors     = signal<any[]>([]);        // ← NEW: all doctors for picker
  readonly tempSelectedDoctor = signal<any | null>(null); // ← NEW

  readonly patientName     = signal('Patient');
  readonly patientEmail    = signal('');
  readonly patientInitials = signal('PT');
  readonly assignedDoctor  = signal<{ firstName: string; lastName: string } | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly selectedDoctorId    = computed(() => this.currentUser()?.doctorId ?? '');
  readonly selectedDoctorFirst = computed(() => this.assignedDoctor()?.firstName ?? '');
  readonly selectedDoctorLast  = computed(() => this.assignedDoctor()?.lastName ?? '');

  // For temp (picker) doctor
  readonly tempSelectedDoctorId    = computed(() => this.tempSelectedDoctor()?.id    ?? '');
  readonly tempSelectedDoctorFirst = computed(() => this.tempSelectedDoctor()?.firstName ?? '');
  readonly tempSelectedDoctorLast  = computed(() => this.tempSelectedDoctor()?.lastName  ?? '');

  // ── UI ────────────────────────────────────────────────────────────────────
  readonly activeNav               = signal<NavSection>('overview');
  readonly sidebarCollapsed        = signal(false);
  readonly rescheduleDialogVisible = signal(false);
  readonly settingsPanelOpen       = signal(false);
  readonly selectedAppointment     = signal<Appointment | null>(null);
  isDark = false;

  // ── Appointment lists ─────────────────────────────────────────────────────
  readonly pendingAppointments   = computed(() => this.appointments().filter(a => a.status === 'PENDING'));
  readonly confirmedAppointments = computed(() => this.appointments().filter(a => a.status === 'CONFIRMED'));
  readonly completedAppointments = computed(() => this.appointments().filter(a => a.status === 'COMPLETED'));
  readonly cancelledAppointments = computed(() => this.appointments().filter(a => a.status === 'CANCELLED'));

  readonly upcomingAppointments = computed(() =>
    this.appointments()
      .filter(a => a.status === 'CONFIRMED' || a.status === 'PENDING')
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
      .slice(0, 3),
  );

  readonly slotOptions = computed<SelectOption<string>[]>(() =>
    this.availableSlots().map(slot => ({ label: slot.substring(11, 16), value: slot })),
  );

  readonly recentConsultations = computed<PatientConsultation[]>(() =>
    [...this.consultations()]
      .sort((a, b) => new Date(b.dateDeConsultation).getTime() - new Date(a.dateDeConsultation).getTime())
      .slice(0, 5),
  );

  // ── Forms ─────────────────────────────────────────────────────────────────
  bookingForm!:        FormGroup;
  rescheduleForm!:     FormGroup;
  changePasswordForm!: FormGroup;
  today = new Date();

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.buildForms();
    if (isPlatformBrowser(this.platformId)) this.loadDarkMode();
    this.loadPatientProfile();
    this.store.select(selectCurrentUser).pipe(
      filter(user => !!user), takeUntil(this.destroy$),
    ).subscribe(user => {
      if (!this.currentUser()) {
        this.currentUser.set(user);
        this.patientEmail.set(user.email);
        this.patientName.set(`${user.firstName} ${user.lastName}`);
        this.patientInitials.set(this.buildInitials(user.firstName, user.lastName));
        this.loadAllData();
      }
    });
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  // ── Profile ───────────────────────────────────────────────────────────────

  loadPatientProfile(): void {
    this.authService.getUserProfile().pipe(takeUntil(this.destroy$)).subscribe({
      next: profile => {
        const p = profile as unknown as UserProfile;
        this.currentUser.set(p);
        this.patientName.set(`${p.firstName} ${p.lastName}`);
        this.patientEmail.set(p.email);
        this.patientInitials.set(this.buildInitials(p.firstName, p.lastName));
        if (p.doctorId) this.loadAssignedDoctor(p.doctorId);
        this.loadAllData();
      },
      error: () => {},
    });
  }

  // ── Doctor picker ─────────────────────────────────────────────────────────

  loadAllDoctors(): void {
    //if (this.allDoctors().length) return; // already loaded
    this.loadingDoctors.set(true);
    // GET /api/v1/doctors — returns all doctors
    this.doctorService.getAllDoctors().pipe(
      takeUntil(this.destroy$),
      finalize(() => this.loadingDoctors.set(false)),
    ).subscribe({
      next: docs => this.allDoctors.set(docs),
      error: () => this.allDoctors.set([]),
    });
  }

  selectTempDoctor(doc: any): void {
    this.tempSelectedDoctor.set(doc);
  }

  /** Called after booking completes — reload profile to get new doctorId */
  onAppointmentBooked(): void {
    this.loadAppointments();
    this.loadPatientProfile(); // picks up doctorId once doctor confirms
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  loadAllData(): void {
    this.loadAppointments();
    this.loadMedicalFile();
    this.loadConsultations();
  }

  loadConsultations(): void {
    const patientId = this.currentUser()?.id;
    if (!patientId) return;
    this.loadingConsultations.set(true);
    this.consultationService.getByPatientId(String(patientId)).pipe(
      takeUntil(this.destroy$),
      finalize(() => { this.loadingConsultations.set(false); this.cdr.detectChanges(); }),
    ).subscribe({
      next: list => this.consultations.set(list),
      error: () => this.consultations.set([]),
    });
  }

  loadAppointments(): void {
    const patientId = this.currentUser()?.id;
    if (!patientId) return;
    this.loadingAppointments.set(true);
    this.appointmentService.findByPatientId(String(patientId)).pipe(
      takeUntil(this.destroy$),
      finalize(() => { this.loadingAppointments.set(false); this.cdr.detectChanges(); }),
    ).subscribe({
      next: all => this.appointments.set(all),
      error: () => { this.appointments.set([]); this.showError('Impossible de charger vos rendez-vous.'); },
    });
  }

  loadMedicalFile(): void {
    const patientId = this.currentUser()?.id;
    if (!patientId) return;
    this.loadingMedicalFile.set(true);
    this.medicalFileService.getByPatientId(String(patientId)).pipe(
      takeUntil(this.destroy$),
      finalize(() => { this.loadingMedicalFile.set(false); this.cdr.detectChanges(); }),
    ).subscribe({
      next: file => this.medicalFile.set(this.withSortedConsultations(file)),
      error: () => this.medicalFile.set(null),
    });
  }

  private loadAssignedDoctor(doctorId: string): void {
    this.loadingDoctor.set(true);
    this.doctorService.getDoctorById(doctorId).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.loadingDoctor.set(false)),
    ).subscribe({
      next: doc => this.assignedDoctor.set(doc),
      error: ()  => this.assignedDoctor.set(null),
    });
  }

  openRescheduleFromTimetable(appointmentId: string): void {
    const appt = this.appointments().find(a => String(a.id) === appointmentId);
    if (appt) { this.openRescheduleDialog(appt); return; }
    this.loadAppointments();
    setTimeout(() => {
      const found = this.appointments().find(a => String(a.id) === appointmentId);
      if (found) this.openRescheduleDialog(found);
    }, 600);
  }

  // ── Reschedule ─────────────────────────────────────────────────────────────

  openRescheduleDialog(appointment: Appointment): void {
    this.selectedAppointment.set(appointment);
    this.rescheduleForm.reset({
      doctorId: appointment.doctorId, date: new Date(appointment.dateTime), selectedSlot: '',
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
    this.appointmentService.getAvailableSlots(doctorId, this.toDateOnly(date)).pipe(
      takeUntil(this.destroy$), finalize(() => this.loadingSlots.set(false)),
    ).subscribe({
      next: r => this.availableSlots.set(r.slots),
      error: () => this.availableSlots.set([]),
    });
  }

  submitReschedule(): void {
    const appointment = this.selectedAppointment();
    const patient     = this.currentUser();
    if (!appointment || !patient || this.rescheduleForm.invalid) {
      this.rescheduleForm.markAllAsTouched(); return;
    }
    const selectedSlot = this.rescheduleForm.get('selectedSlot')?.value;
    if (!selectedSlot) { this.showError('Veuillez sélectionner un nouveau créneau.'); return; }

    const request: AppointmentRequest = {
      patientId: String(patient.id), doctorId: appointment.doctorId,
      dateTime: selectedSlot, status: 'PENDING',
      patientEmail: patient.email, patientFirstName: patient.firstName,
      patientLastName: patient.lastName, appointmentType: appointment.appointmentType,
    };
    this.submittingAppointment.set(true);
    this.appointmentService.reschedule(appointment.id, request).pipe(
      takeUntil(this.destroy$), finalize(() => this.submittingAppointment.set(false)),
    ).subscribe({
      next: updated => {
        this.appointments.update(list => list.map(a => a.id === updated.id ? updated : a));
        this.rescheduleDialogVisible.set(false);
        this.messageService.add({ severity: 'success', summary: 'Demande envoyée', detail: 'Le médecin devra valider le nouveau créneau.' });
        this.loadAppointments();
      },
      error: (err: unknown) => this.showError(this.errorMessage(err)),
    });
  }

  // ── Password ───────────────────────────────────────────────────────────────

  submitChangePassword(): void {
    if (this.changePasswordForm.invalid) { this.changePasswordForm.markAllAsTouched(); return; }
    this.submittingPassword.set(true);
    const { currentPassword, newPassword } = this.changePasswordForm.value;
    this.patientService.changePassword({ currentPassword, newPassword }).pipe(
      takeUntil(this.destroy$), finalize(() => this.submittingPassword.set(false)),
    ).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Mot de passe modifié', detail: 'Votre mot de passe a été mis à jour.' });
        this.changePasswordForm.reset();
      },
      error: (err: unknown) => this.showError(this.errorMessage(err)),
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  navigateTo(section: NavSection): void {
    this.activeNav.set(section);
    this.settingsPanelOpen.set(section === 'settings');
    // Load doctors when navigating to booking without an assigned doctor
    if (section === 'booking' && !this.selectedDoctorId()) {
      this.tempSelectedDoctor.set(null);
      this.loadAllDoctors();
    }
  }

  toggleSidebar(): void  { this.sidebarCollapsed.update(v => !v); }
  toggleSettings(): void { this.settingsPanelOpen.update(v => !v); }

  toggleDark(): void {
    this.isDark = !this.isDark;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cardiosense-dark', String(this.isDark));
      document.body.classList.toggle('dark-mode', this.isDark);
    }
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/auth/authenticate';
    }
  }

  // ── Display helpers ────────────────────────────────────────────────────────

  statusLabel(status: string | undefined): string {
    const map: Record<string, string> = {
      PENDING: 'En attente', CONFIRMED: 'Accepté', RESCHEDULED: 'Reprogrammé',
      CANCELLED: 'Annulé', COMPLETED: 'Terminé',
    };
    return status ? (map[status] ?? status) : 'Inconnu';
  }

  statusSeverity(status: string | undefined): 'success' | 'danger' | 'warn' | 'info' | 'secondary' {
    const map: Record<string, 'success' | 'danger' | 'warn' | 'info' | 'secondary'> = {
      PENDING: 'warn', CONFIRMED: 'success', RESCHEDULED: 'info',
      CANCELLED: 'danger', COMPLETED: 'secondary',
    };
    return status ? (map[status] ?? 'secondary') : 'secondary';
  }

  statusIcon(status: string | undefined): string {
    const map: Record<string, string> = {
      PENDING: 'pi pi-clock', CONFIRMED: 'pi pi-check-circle',
      RESCHEDULED: 'pi pi-calendar-clock', CANCELLED: 'pi pi-times-circle', COMPLETED: 'pi pi-check-square',
    };
    return status ? (map[status] ?? 'pi pi-circle') : 'pi pi-circle';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    try { return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return dateStr; }
  }

  formatDateTime(dateStr?: string): string {
    if (!dateStr) return '—';
    try { return new Date(dateStr).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return dateStr; }
  }

  skeletonArray(n: number): number[] { return Array.from({ length: n }, (_, i) => i); }

  isFieldInvalid(form: FormGroup, field: string): boolean {
    const ctrl = form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  buildInitials(first?: string, last?: string): string {
    if (first && last) return (first[0] + last[0]).toUpperCase();
    if (first) return first[0].toUpperCase();
    return 'PT';
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private withSortedConsultations(file: MedicalFile): MedicalFile {
    if (!file.consultations?.length) return file;
    return { ...file, consultations: [...file.consultations].sort((a, b) => new Date(b.dateDeConsultation).getTime() - new Date(a.dateDeConsultation).getTime()) };
  }

  private toDateOnly(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
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
      doctorId: ['', Validators.required], date: [new Date(), Validators.required], selectedSlot: ['', Validators.required],
    });
    this.rescheduleForm = this.fb.group({
      doctorId: ['', Validators.required], date: [new Date(), Validators.required], selectedSlot: ['', Validators.required],
    });
    this.changePasswordForm = this.fb.group(
      { currentPassword: ['', Validators.required], newPassword: ['', [Validators.required, Validators.minLength(8)]], confirmPassword: ['', Validators.required] },
      { validators: this.passwordsMatch },
    );
  }

  private passwordsMatch(group: FormGroup): { [key: string]: boolean } | null {
    const np = group.get('newPassword')?.value;
    const cp = group.get('confirmPassword')?.value;
    return np && cp && np !== cp ? { mismatch: true } : null;
  }
}