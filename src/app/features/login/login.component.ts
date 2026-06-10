// login.component.ts
import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { DividerModule } from 'primeng/divider';
import { CardModule } from 'primeng/card';
import { FloatLabelModule } from 'primeng/floatlabel';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

import { AuthActions } from '../../store/auth/auth.actions';
import { selectAuthLoading, selectAuthError } from '../../store/auth/auth.selectors';
import { LoginForm } from '../../shared/models/login-form';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    CheckboxModule,
    DividerModule,
    MessageModule,
    FloatLabelModule,
    IconFieldModule,
    InputIconModule,
  ],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm!: FormGroup<LoginForm>;
  loading$!: any;
  error$!: Observable<string | null>;
  isDark = false;
  private destroy$ = new Subject<void>();
  rememberMe = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly store: Store,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {

    const rememberMeValue = isPlatformBrowser(this.platformId) ? localStorage.getItem('rememberMe') : null;

    if (rememberMeValue === 'true') {
      this.rememberMe = true;
    }
  }

  ngOnInit(): void {
    this.loading$ = this.store.select(selectAuthLoading);
    this.error$ = this.store.select(selectAuthError);

    this.loginForm = this.fb.nonNullable.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false],
    });

    this.loginForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.store.dispatch(AuthActions.clearError());
    });

    // Only access localStorage in the browser, never during SSR
    if (isPlatformBrowser(this.platformId)) {
      this.isDark = localStorage.getItem('CardioConsult-dark') === 'true';
      this.applyDarkMode();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get email() { return this.loginForm.get('email')!; }
  get password() { return this.loginForm.get('password')!; }

  isFieldInvalid(field: string): boolean {
    const control = this.loginForm.get(field);
    return !!(control && control.invalid && control.touched);
  }

  toggleDarkMode(): void {
    this.isDark = !this.isDark;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('CardioConsult-dark', String(this.isDark));
      this.applyDarkMode();
    }
  }

  private applyDarkMode(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.toggle('dark-mode', this.isDark);
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password, rememberMe } = this.loginForm.value;
    this.store.dispatch(AuthActions.login({
      request: { email: email!, password: password!, rememberMe: rememberMe || false },
    }));
  }
}