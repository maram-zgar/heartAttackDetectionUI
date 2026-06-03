import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, switchMap, tap, withLatestFrom } from 'rxjs/operators';
import { AuthService } from '../../core/auth/auth.service';
import { AuthActions, rehydrateAuth } from './auth.actions';
import { EMPTY, of } from 'rxjs';
import { selectIsAuthenticated } from './auth.selectors';
import { Store } from '@ngrx/store';
import { UserRole } from '../../shared/models/user-profile.model';

@Injectable()
export class AuthEffects {
  private readonly actions$ = inject(Actions);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly store = inject(Store);

  private isBrowser = isPlatformBrowser(this.platformId);

  // ── App init ────────────────────────────────────────────────────────────────

  initializeApp$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.initializeApp),
      switchMap(() => {
        if (!this.isBrowser) return EMPTY;

        const accessToken  = localStorage.getItem('access_token');
        const refreshToken = localStorage.getItem('refresh_token');
        const rememberMe   = localStorage.getItem('rememberMe') === 'true';

        if (rememberMe && this.authService.hasRefreshToken()) {
          return this.authService.refreshToken().pipe(
            map(res => AuthActions.refreshTokenSuccess({
              accessToken:  res.accessToken,
              refreshToken: res.refreshToken!,
            })),
            catchError(err => {
              if (accessToken) {
                return of(rehydrateAuth({ accessToken, refreshToken, rememberMe: false }));
              }
              return of(AuthActions.refreshTokenFailure());
            }),
          );
        }

        if (accessToken) {
          return of(rehydrateAuth({ accessToken, refreshToken, rememberMe: false }));
        }

        return EMPTY;
      }),
    ),
  );

  // ── Rehydrate → load profile ────────────────────────────────────────────────

  loadProfileAfterRehydrate$ = createEffect(() =>
    this.actions$.pipe(
      ofType(rehydrateAuth),
      switchMap(() =>
        this.authService.getUserProfile().pipe(
          map(profile => AuthActions.loadProfileSuccess({ profile })),
          catchError(err =>
            of(AuthActions.loadProfileFailure({
              error: err.error?.message || 'Impossible de récupérer le profil utilisateur.',
            })),
          ),
        ),
      ),
    ),
  );

  // ── Login ───────────────────────────────────────────────────────────────────

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.login),
      switchMap(({ request }) =>
        this.authService.authenticate(request).pipe(
          tap((res: any) => {
            if (this.isBrowser && res.accessToken && res.refreshToken) {
              localStorage.setItem('access_token',  res.accessToken);
              localStorage.setItem('refresh_token', res.refreshToken);
              if (request.rememberMe) {
                localStorage.setItem('rememberMe', 'true');
              }
            }
          }),
          map((res: any) =>
            AuthActions.loginSuccess({
              accessToken:  res.accessToken,
              refreshToken: res.refreshToken,
              rememberMe:   request.rememberMe ?? false,
            }),
          ),
          catchError(err =>
            of(AuthActions.loginFailure({
              error: err.error?.message || 'Échec de la connexion.',
            })),
          ),
        ),
      ),
    ),
  );

  loginSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loginSuccess),
        tap(({ rememberMe }) => {
          if (!this.isBrowser) return;
          if (!rememberMe) localStorage.removeItem('rememberMe');
        }),
      ),
    { dispatch: false },
  );

  loadProfileAfterLogin$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.loginSuccess),
      switchMap(() =>
        this.authService.getUserProfile().pipe(
          map(profile => AuthActions.loadProfileSuccess({ profile })),
          catchError(err =>
            of(AuthActions.loadProfileFailure({
              error: err.error?.message || 'Impossible de récupérer le profil utilisateur.',
            })),
          ),
        ),
      ),
    ),
  );

  loadProfileSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loadProfileSuccess),
        tap(({ profile }) => {
          const isAuthPage = this.router.url.includes('/auth');
          if (isAuthPage) {
            this.router.navigateByUrl(this.getDashboardRoute(profile.role));
          }
        }),
      ),
    { dispatch: false },
  );

  // ── Signup ──────────────────────────────────────────────────────────────────
  // After signup the backend returns tokens, but we DON'T auto-login.
  // The signup component itself clears tokens and redirects to /auth/authenticate.

  signup$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.signup),
      switchMap(({ request }) =>
        this.authService.signup(request).pipe(
          map(res =>
            AuthActions.signupSuccess({
              accessToken:  res.accessToken,
              refreshToken: res.refreshToken,
              rememberMe:   false,
            }),
          ),
          catchError(err =>
            of(AuthActions.signupFailure({
              error: err.error?.message || "Échec de l'inscription.",
            })),
          ),
        ),
      ),
    ),
  );

  /**
   * signupSuccess$ — intentionally does NOTHING with the tokens.
   * The SignupComponent listens for this action, wipes tokens from
   * localStorage, and redirects to /auth/authenticate.
   */
  signupSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.signupSuccess),
        tap(() => {
          // Ensure no tokens are persisted from signup
          if (this.isBrowser) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('rememberMe');
          }
          // Navigation is handled by the SignupComponent to allow it to show
          // a success message before redirecting
        }),
      ),
    { dispatch: false },
  );

  // ── Logout ──────────────────────────────────────────────────────────────────

  logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.logout),
      switchMap(() =>
        this.authService.logout().pipe(
          map(() => AuthActions.logoutSuccess()),
          catchError(() => of(AuthActions.logoutSuccess())),
        ),
      ),
    ),
  );

  logoutSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.logoutSuccess),
        tap(() => {
          if (this.isBrowser) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('rememberMe');
          }
          this.authService.clearTokens();
          this.router.navigateByUrl('/auth/authenticate');
        }),
      ),
    { dispatch: false },
  );

  // ── Token refresh ───────────────────────────────────────────────────────────

  refreshToken$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.refreshToken),
      exhaustMap(() => {
        if (!this.authService.hasRefreshToken()) {
          return of(AuthActions.refreshTokenFailure());
        }
        return this.authService.refreshToken().pipe(
          map(res => AuthActions.refreshTokenSuccess({
            accessToken:  res.accessToken,
            refreshToken: res.refreshToken!,
          })),
          catchError(() => of(AuthActions.refreshTokenFailure())),
        );
      }),
    ),
  );

  refreshTokenSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.refreshTokenSuccess),
        tap(({ accessToken, refreshToken }) => {
          if (this.isBrowser) {
            localStorage.setItem('access_token',  accessToken);
            localStorage.setItem('refresh_token', refreshToken);
          }
        }),
      ),
    { dispatch: false },
  );

  refreshTokenFailure$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.refreshTokenFailure),
        withLatestFrom(this.store.select(selectIsAuthenticated)),
        tap(([, wasAuthenticated]) => {
          this.authService.clearTokens();
          if (wasAuthenticated && this.isBrowser) {
            this.router.navigate(['/auth/authenticate']);
          }
        }),
      ),
    { dispatch: false },
  );

  private getDashboardRoute(role: UserRole): string {
    switch (role) {
      case 'ADMIN':   return '/admin';
      case 'DOCTOR':  return '/doctor/dashboard';
      case 'PATIENT': return '/patient/dashboard';
      default:        return '/auth/authenticate';
    }
  }
}