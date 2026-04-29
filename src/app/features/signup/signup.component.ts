// signup.component.ts
import { Component, OnInit, OnDestroy, Signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
  ReactiveFormsModule,
} from '@angular/forms';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DividerModule } from 'primeng/divider';
import { StepperModule } from 'primeng/stepper';
import { RippleModule } from 'primeng/ripple';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

import { AuthActions } from '../../store/auth/auth.actions';
import { selectAuthLoading, selectAuthError } from '../../store/auth/auth.selectors';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password');
  const confirm = control.get('confirmPassword');
  if (password && confirm && password.value !== confirm.value) {
    confirm.setErrors({ passwordMismatch: true });
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    CheckboxModule,
    DividerModule,
    StepperModule,
    RippleModule,
    SelectModule,
    MessageModule,
    IconFieldModule,
    InputIconModule,
  ],
  templateUrl: './signup.component.html',
})
export class SignupComponent implements OnInit, OnDestroy {
  loading!: Signal<boolean>;
  error!: Signal<string | null>;
  isDark = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly store: Store,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {
    this.loading = this.store.selectSignal(selectAuthLoading);
    this.error = this.store.selectSignal(selectAuthError);
  }

  signupForm!: FormGroup;

  roles = [
    { label: 'Cardiologue', value: 'CARDIOLOGIST' },
    { label: 'Patient', value: 'PATIENT' }
  ];

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.signupForm = this.fb.group(
      {
        firstName: ['', [Validators.required, Validators.minLength(2)]],
        lastName: ['', [Validators.required, Validators.minLength(2)]],
        email: ['', [Validators.required, Validators.email]],
        role: ['', Validators.required],
        password: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
          ],
        ],
        confirmPassword: ['', Validators.required],
        terms: [false, Validators.requiredTrue],
      },
      { validators: passwordMatchValidator },
    );

    this.signupForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.store.dispatch(AuthActions.clearError());
    });

    // Only access localStorage in the browser, never during SSR
    if (isPlatformBrowser(this.platformId)) {
      this.isDark = localStorage.getItem('cardiosense-dark') === 'true';
      this.applyDarkMode();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get firstName() { return this.signupForm.get('firstName')!; }
  get lastName() { return this.signupForm.get('lastName')!; }
  get email() { return this.signupForm.get('email')!; }
  get role() { return this.signupForm.get('role')!; }
  get password() { return this.signupForm.get('password')!; }
  get confirmPassword() { return this.signupForm.get('confirmPassword')!; }
  get terms() { return this.signupForm.get('terms')!; }

  isFieldInvalid(field: string): boolean {
    const control = this.signupForm.get(field);
    return !!(control && control.invalid && control.touched);
  }

  getPasswordStrength(): { label: string; level: number } {
    const val = this.password.value || '';
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[@$!%*?&]/.test(val)) score++;
    const levels = [
      { label: '', level: 0 },
      { label: 'Faible', level: 1 },
      { label: 'Moyen', level: 2 },
      { label: 'Bien', level: 3 },
      { label: 'Fort', level: 4 },
    ];
    return levels[score];
  }

  toggleDarkMode(): void {
    this.isDark = !this.isDark;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cardiosense-dark', String(this.isDark));
      this.applyDarkMode();
    }
  }

  private applyDarkMode(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.toggle('dark-mode', this.isDark);
    }
  }

  onSubmit(): void {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    const { firstName, lastName, email, password } = this.signupForm.value;
    this.store.dispatch(AuthActions.signup({ request: { firstName, lastName, email, password } }));
  }
}