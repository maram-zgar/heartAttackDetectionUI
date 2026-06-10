// signup.component.ts
import {
  Component, OnInit, OnDestroy, Signal,
  Inject, PLATFORM_ID, computed,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  FormBuilder, FormGroup, Validators,
  AbstractControl, ValidationErrors, ReactiveFormsModule,
} from '@angular/forms';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';

import { InputTextModule }  from 'primeng/inputtext';
import { PasswordModule }   from 'primeng/password';
import { ButtonModule }     from 'primeng/button';
import { SelectModule }     from 'primeng/select';
import { MessageModule }    from 'primeng/message';
import { IconFieldModule }  from 'primeng/iconfield';
import { InputIconModule }  from 'primeng/inputicon';
import { DatePickerModule } from 'primeng/datepicker';
import { CheckboxModule }   from 'primeng/checkbox';

import { AuthActions } from '../../store/auth/auth.actions';
import { selectAuthLoading, selectAuthError } from '../../store/auth/auth.selectors';
import { Actions, ofType } from '@ngrx/effects';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const pw = control.get('password');
  const cf = control.get('confirmPassword');
  if (pw && cf && pw.value !== cf.value) {
    cf.setErrors({ passwordMismatch: true });
    return { passwordMismatch: true };
  }
  // clear the mismatch error when they match
  if (cf?.errors?.['passwordMismatch']) {
    const { passwordMismatch, ...rest } = cf.errors;
    cf.setErrors(Object.keys(rest).length ? rest : null);
  }
  return null;
}

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule,
    InputTextModule, PasswordModule, ButtonModule,
    SelectModule, MessageModule, IconFieldModule,
    InputIconModule, DatePickerModule, CheckboxModule,
  ],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss'],
})
export class SignupComponent implements OnInit, OnDestroy {
  loading!: Signal<boolean>;
  error!:   Signal<string | null>;
  isDark  = false;

  signupForm!: FormGroup;
  currentStep  = 1;
  computedAge: number | null = null;
  readonly maxDate = new Date();

  readonly genderOptions = [
    { label: 'Homme',  value: 'MALE'   },
    { label: 'Femme',  value: 'FEMALE' },
    { label: 'Autre',  value: 'OTHER'  },
  ];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly store: Store,
    private readonly actions$: Actions,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {
    this.loading = this.store.selectSignal(selectAuthLoading);
    this.error   = this.store.selectSignal(selectAuthError);
  }

  ngOnInit(): void {
    this.signupForm = this.fb.group(
      {
        firstName:       ['', [Validators.required, Validators.minLength(2)]],
        lastName:        ['', [Validators.required, Validators.minLength(2)]],
        email:           ['', [Validators.required, Validators.email]],
        password:        ['', [Validators.required, Validators.minLength(8),
                               Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)]],
        confirmPassword: ['', Validators.required],
        dateOfBirth:     [null],
        gender:          [null],
      },
      { validators: passwordMatchValidator },
    );

    // Clear store error on any change
    this.signupForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() =>
      this.store.dispatch(AuthActions.clearError())
    );

    // Auto-compute age from dateOfBirth
    this.signupForm.get('dateOfBirth')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(dob => {
        this.computedAge = dob ? this.calcAge(dob as Date) : null;
      });

    // ── After signup success → redirect to login (NO auto-login) ──
    // We listen for signupSuccess and navigate manually so no JWT is
    // stored and the user must log in fresh.
    this.actions$.pipe(
      ofType(AuthActions.signupSuccess),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      if (isPlatformBrowser(this.platformId)) {
        // Clear any tokens the effect might have stored
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/auth/authenticate?registered=1';
      }
    });

    if (isPlatformBrowser(this.platformId)) {
      this.isDark = localStorage.getItem('CardioConsult-dark') === 'true';
      document.body.classList.toggle('dark-mode', this.isDark);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Getters ───────────────────────────────────────────────────
  get firstName()       { return this.signupForm.get('firstName')!; }
  get lastName()        { return this.signupForm.get('lastName')!; }
  get email()           { return this.signupForm.get('email')!; }
  get password()        { return this.signupForm.get('password')!; }
  get confirmPassword() { return this.signupForm.get('confirmPassword')!; }
  get dateOfBirth()     { return this.signupForm.get('dateOfBirth')!; }
  get gender()          { return this.signupForm.get('gender')!; }

  isFieldInvalid(field: string): boolean {
    const c = this.signupForm.get(field);
    return !!(c?.invalid && c.touched);
  }

  getPasswordStrength(): { label: string; level: number } {
    const v = this.password.value ?? '';
    let s = 0;
    if (v.length >= 8)       s++;
    if (/[A-Z]/.test(v))     s++;
    if (/[0-9]/.test(v))     s++;
    if (/[@$!%*?&]/.test(v)) s++;
    return [
      { label: '',       level: 0 },
      { label: 'Faible', level: 1 },
      { label: 'Moyen',  level: 2 },
      { label: 'Bien',   level: 3 },
      { label: 'Fort',   level: 4 },
    ][s];
  }

  // ── Step navigation ───────────────────────────────────────────

  nextStep(): void {
    ['firstName', 'lastName', 'email', 'password', 'confirmPassword']
      .forEach(f => this.signupForm.get(f)?.markAsTouched());

    const ok =
      this.firstName.valid &&
      this.lastName.valid &&
      this.email.valid &&
      this.password.valid &&
      this.confirmPassword.valid &&
      !this.signupForm.hasError('passwordMismatch');

    if (ok) this.currentStep = 2;
  }

  prevStep(): void { this.currentStep = 1; }

  // ── Dark mode ─────────────────────────────────────────────────

  toggleDarkMode(): void {
    this.isDark = !this.isDark;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('CardioConsult-dark', String(this.isDark));
      document.body.classList.toggle('dark-mode', this.isDark);
    }
  }

  // ── Submit ────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.signupForm.invalid) { this.signupForm.markAllAsTouched(); return; }

    const { firstName, lastName, email, password, dateOfBirth, gender } =
      this.signupForm.value;

    const dobStr = dateOfBirth
      ? (dateOfBirth as Date).toISOString().split('T')[0]
      : undefined;

    // Dispatch signup — the signupSuccess$ effect will be intercepted
    // above (in ngOnInit) to clear tokens & redirect to /auth/authenticate
    this.store.dispatch(AuthActions.signup({
      request: { firstName, lastName, email, password, dateOfBirth: dobStr, gender: gender ?? undefined },
    }));
  }

  private calcAge(dob: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return Math.max(0, age);
  }
}