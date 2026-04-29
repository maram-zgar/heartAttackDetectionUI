import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, exhaustMap, filter, map, switchMap, tap, withLatestFrom } from 'rxjs/operators';
import { AuthService } from '../../core/auth/auth.service';
import { AuthActions } from './auth.actions';

import { selectIsAuthenticated } from './auth.selectors';
import { Store } from '@ngrx/store';
import { UserRole } from '../../shared/models/user-profile.model';
import { JwtDecoder } from '../../core/utils/jwt.decoder';

@Injectable()
export class AuthEffects {
  private readonly actions$ = inject(Actions);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly store = inject(Store);

  private isBrowser = isPlatformBrowser(this.platformId);

  initializeApp$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.initializeApp),
      tap(() => console.log(' [AUTH EFFECTS] INITIALIZE APP ACTION')),
      filter(() => this.isBrowser),
      switchMap(() => {
        const rememberMe = localStorage.getItem('rememberMe') === 'true';
        const hasRefreshToken = this.authService.hasRefreshToken();
        
        console.log(' [AUTH EFFECTS] isBrowser:', this.isBrowser);
        console.log(' [AUTH EFFECTS] rememberMe from storage:', rememberMe);
        
        if (rememberMe && this.authService.hasRefreshToken()) {
          console.log(' [AUTH EFFECTS] Attempting to refresh token...');
          const token = this.authService.getRefreshToken();
          console.log(' [AUTH EFFECTS] Refresh token exists:', !!token);
          
          return this.authService.refreshToken().pipe(
            tap((res) => console.log(' [AUTH EFFECTS] Token refresh succeeded:', res.accessToken?.substring(0, 20) + '...')),
            map((res) =>
              AuthActions.refreshTokenSuccess({ accessToken: res.accessToken })
            ),
            catchError((err) => {
              console.error(' [AUTH EFFECTS] Token refresh failed:', err.status, err.error);
              return of(AuthActions.refreshTokenFailure());
            })
          );
        }
        console.log('⏭ [AUTH EFFECTS] No rememberMe or refresh token, skip refresh');
        return of(AuthActions.refreshTokenFailure());
      })
    )
  );

  login$ = createEffect(() =>
  this.actions$.pipe(
    ofType(AuthActions.login),
    tap(({ request }) => console.log(' [AUTH EFFECTS] LOGIN ACTION for:', request.email)),
    switchMap(({ request }) =>
      this.authService.authenticate(request).pipe(
        tap((res: any) => {
          console.log(' [AUTH EFFECTS] LOGIN HTTP SUCCESS');
          console.log(' [AUTH EFFECTS] accessToken:', res.accessToken?.substring(0, 20) + '...');
          console.log(' [AUTH EFFECTS] refreshToken:', res.refreshToken?.substring(0, 20) + '...');
        }),
        map((res: any) => {
          return AuthActions.loginSuccess({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            rememberMe: request.rememberMe ?? false,
          });
        }),
        catchError((err) => {
          console.error(' [AUTH EFFECTS] LOGIN HTTP FAILED');
          console.error(' [AUTH EFFECTS] Status:', err.status);
          console.error(' [AUTH EFFECTS] Error:', err.error);
          return of(AuthActions.loginFailure({
            error: err.error?.message || 'Échec de la connexion.',
          }));
        })
      )
    )
  )
);

  loginSuccess$ = createEffect(
  () =>
    this.actions$.pipe(
      ofType(AuthActions.loginSuccess),
      tap(({ accessToken, refreshToken, rememberMe }) => {
        console.log(' [AUTH EFFECTS] LOGIN SUCCESS ACTION RECEIVED');
        console.log(' [AUTH EFFECTS] accessToken:', accessToken?.substring(0, 20) + '...');
        console.log(' [AUTH EFFECTS] refreshToken:', refreshToken?.substring(0, 20) + '...');
        console.log(' [AUTH EFFECTS] rememberMe:', rememberMe);
        
        // Decode and log JWT claims
        if (accessToken) {
          console.log('\n DECODING ACCESS TOKEN:');
          const tokenInfo = JwtDecoder.getTokenInfo(accessToken);
          console.log(' Token valid:', tokenInfo.isValid);
          console.log(' Token expired:', tokenInfo.isExpired);
          console.log(' Token expires at:', tokenInfo.expiresAt);
          console.log(' Token role:', tokenInfo.role);
          console.log(' Token authorities:', JSON.stringify(tokenInfo.authorities));
          console.log(' Full claims:', JSON.stringify(tokenInfo.claims, null, 2));
        }
        
        if (this.isBrowser) {
          if (rememberMe) {
            localStorage.setItem('rememberMe', 'true');
            console.log(' [AUTH EFFECTS] Saved rememberMe=true');
          } else {
            localStorage.removeItem('rememberMe');
            console.log(' [AUTH EFFECTS] Cleared rememberMe');
          }
          if (accessToken && refreshToken) {
            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('refresh_token', refreshToken);
            console.log(' [AUTH EFFECTS] Tokens saved to localStorage');
            console.log(' [AUTH EFFECTS] Verify - access_token in storage:', !!localStorage.getItem('access_token'));
            console.log(' [AUTH EFFECTS] Verify - refresh_token in storage:', !!localStorage.getItem('refresh_token'));
          }
        } else {
          console.log(' [AUTH EFFECTS] Not in browser - cannot save tokens');
        }
      }),
    ),
  { dispatch: false }
);

  loadProfileAfterSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.loginSuccess, AuthActions.refreshTokenSuccess),
      switchMap(() =>
        this.authService.getUserProfile().pipe(
          map((profile) => AuthActions.loadProfileSuccess({ profile })),
          catchError((err) => of(AuthActions.loadProfileFailure({ error: err.message })))
        )
      )
    )
  );

  loadProfileSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loadProfileSuccess),
        tap(({ profile }) => {
          // Only navigate if we aren't already on a protected page
          const onAuthPage = this.router.url.includes('/auth');
          if (onAuthPage) {
            const destination = this.getDashboardRoute(profile.role);
            this.router.navigateByUrl(destination);
          }
        })
      ),
    { dispatch: false }
  );

  signup$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.signup),
      switchMap(({ request }) =>
        this.authService.signup(request).pipe(
          map((res) =>
            AuthActions.signupSuccess({
              accessToken:  res.accessToken,
              refreshToken: res.refreshToken,
              rememberMe:   false,
            })
          ),
          catchError((err) =>
            of(AuthActions.signupFailure({
              error: err.error?.message || "Échec de l'inscription.",
            }))
          )
        )
      )
    )
  );

  signupSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.signupSuccess),
        tap(() => {
          this.router.navigateByUrl("/auth/authenticate");
        })
      ),
    { dispatch: false }
  );

  logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.logout),
      switchMap(() =>
        this.authService.logout().pipe(
          map(() => AuthActions.logoutSuccess()),
          catchError(() => of(AuthActions.logoutSuccess()))
        )
      )
    )
  );

  logoutSuccess$ = createEffect(
  () =>
    this.actions$.pipe(
      ofType(AuthActions.logoutSuccess),
      tap(() => {
        this.authService.clearTokens();
        if (this.isBrowser) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('rememberMe');
        }
        this.router.navigateByUrl('/auth/authenticate');
      })
    ),
  { dispatch: false }
);

  refreshToken$ = createEffect(() =>
  this.actions$.pipe(
    ofType(AuthActions.refreshToken),
    exhaustMap(() => {
      if (!this.authService.hasRefreshToken()) {
        return of(AuthActions.refreshTokenFailure());
      }

      return this.authService.refreshToken().pipe(
        map(res => AuthActions.refreshTokenSuccess({ accessToken: res.accessToken })),
        catchError(() => of(AuthActions.refreshTokenFailure()))
      );
    })
  )
);

  refreshTokenFailure$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.refreshTokenFailure),
      tap(() => {
        // Delegate token cleanup to the service (SSR-safe)
        this.authService.clearTokens();
      }),
      withLatestFrom(this.store.select(selectIsAuthenticated)),
      tap(([, isAuthenticated]) => {
        const onAuthPage = this.router.url.includes('/auth');
        if (isAuthenticated && !onAuthPage) {
          this.router.navigate(['/auth/authenticate']);
        }
      })
    ),
    { dispatch: false }
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
