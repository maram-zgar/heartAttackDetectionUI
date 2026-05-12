import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, switchMap, tap, withLatestFrom } from 'rxjs/operators';
import { AuthService } from '../../core/auth/auth.service';
import { AuthActions, rehydrateAuth } from './auth.actions';
import { EMPTY, of }                       from 'rxjs';

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
      switchMap(() => {

        if (!this.isBrowser) return EMPTY;

        const accessToken   = localStorage.getItem('access_token');
        const refreshToken  = localStorage.getItem('refresh_token');
        const rememberMe = localStorage.getItem('rememberMe') === 'true';
        
        console.log(' [AUTH EFFECTS] rememberMe from storage:', rememberMe);
        
        if (rememberMe && this.authService.hasRefreshToken()) {
          console.log(' [AUTH EFFECTS] Attempting to refresh token...');
          
          return this.authService.refreshToken().pipe(
            tap((res) => console.log(' [AUTH EFFECTS] Token refresh succeeded:', res.accessToken?.substring(0, 20) + '...')),
            map((res) =>
              AuthActions.refreshTokenSuccess({ 
                accessToken: res.accessToken,
                refreshToken: res.refreshToken!,
             })
            ),
            catchError((err) => {
              if (accessToken) {
                return of(rehydrateAuth({
                  accessToken,
                  refreshToken,
                  rememberMe: false,
                }));
              }
              console.error(' [AUTH EFFECTS] Token refresh failed:', err.status, err.error);
              return of(AuthActions.refreshTokenFailure());
            })
          );
        }

        if (accessToken) {
          return of(
            rehydrateAuth({
              accessToken,
              refreshToken,
              rememberMe: false,
            })
          );
        }

        return EMPTY;
      })
    )
  );

  loadProfileAfterRehydrate$ = createEffect(() =>
    this.actions$.pipe(
      ofType(rehydrateAuth),
      switchMap(() =>
        this.authService.getUserProfile().pipe(
          map((profile) => AuthActions.loadProfileSuccess({ profile })),
          catchError((err) =>
            of(AuthActions.loadProfileFailure({
              error: err.error?.message || 'Impossible de récupérer le profil utilisateur.',
            }))
          )
        )
      )
    )
  );

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.login),
      switchMap(({ request }) =>
        this.authService.authenticate(request).pipe(
          tap((res: any) => {
            // Store tokens HERE, synchronously, before loginSuccess dispatches
            if (this.isBrowser && res.accessToken && res.refreshToken) {
              localStorage.setItem('access_token', res.accessToken);
              localStorage.setItem('refresh_token', res.refreshToken);
              if (request.rememberMe) {
                localStorage.setItem('rememberMe', 'true');
              }
            }
          }),
          map((res: any) =>
            AuthActions.loginSuccess({
              accessToken: res.accessToken,
              refreshToken: res.refreshToken,
              rememberMe: request.rememberMe ?? false,
            }),
          ),
          catchError((err) =>
            of(AuthActions.loginFailure({
              error: err.error?.message || 'Échec de la connexion.',
            }))
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
          if (!rememberMe) {
            localStorage.removeItem('rememberMe');
          }
          // Tokens already saved in login$ tap above
        }),
      ),
    { dispatch: false },
  );

  loadProfileAfterLogin$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.loginSuccess),
      switchMap(() =>
        this.authService.getUserProfile().pipe(
          tap((profile) => {
            console.log(' [AUTH EFFECTS] User profile loaded');
            console.log(' [AUTH EFFECTS] User email:', profile.email);
            console.log(' [AUTH EFFECTS] User role:', profile.role);
            console.log(' [AUTH EFFECTS] Full profile:', profile);
          }),
          map((profile) => AuthActions.loadProfileSuccess({ profile })),
          catchError((err) => {
            console.error(' [AUTH EFFECTS] Failed to load profile:', err.error);
            return of(AuthActions.loadProfileFailure({
              error: err.error?.message || 'Impossible de récupérer le profil utilisateur.',
            }));
          })
        )
      )
    )
  );

  loadProfileSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loadProfileSuccess),
        tap(({ profile }) => {
          console.log(' [AUTH EFFECTS] Routing to dashboard for role:', profile.role);
          const isAuthPage = this.router.url.includes('/auth');
          if (isAuthPage) {
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
        tap(({ accessToken, refreshToken }) => {
          if (this.isBrowser && accessToken && refreshToken) {
            // 1. Save the tokens so the /me request is authorized
            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('refresh_token', refreshToken);
            
            // 2. Dispatch loginSuccess to trigger loadProfileAfterLogin$
            this.store.dispatch(AuthActions.loginSuccess({ 
              accessToken, 
              refreshToken, 
              rememberMe: false 
            }));
          }
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
        if (this.isBrowser) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('rememberMe');
        }
        this.authService.clearTokens();
        this.router.navigateByUrl('/auth/authenticate');
      })
    ),
  { dispatch: false }
);

  refreshToken$ = createEffect(() =>
  this.actions$.pipe(
    ofType(AuthActions.refreshToken),
    exhaustMap(() => {
      // Use the service method — it reads the token internally
      if (!this.authService.hasRefreshToken()) {
        return of(AuthActions.refreshTokenFailure());
      }

      return this.authService.refreshToken().pipe(
        map(res => AuthActions.refreshTokenSuccess({ accessToken: res.accessToken, refreshToken: res.refreshToken!, })),
        catchError(() => of(AuthActions.refreshTokenFailure()))
      );
    })
  )
);

  refreshTokenSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.refreshTokenSuccess),
        tap(({ accessToken, refreshToken }) => {
          if (this.isBrowser) {
            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('refresh_token', refreshToken);
          }
        })
      ),
    { dispatch: false }
  );

  refreshTokenFailure$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.refreshTokenFailure),
      // Check authentication state BEFORE clearTokens() mutates the store
      withLatestFrom(this.store.select(selectIsAuthenticated)),
      tap(([, wasAuthenticated]) => {
        this.authService.clearTokens();

        // Only redirect to login if the session was previously active.
        // Avoids redirecting during a cold start where no session existed.
        if (wasAuthenticated && this.isBrowser) {
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
