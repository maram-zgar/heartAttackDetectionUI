import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { createSelector, Store } from '@ngrx/store';
import { catchError, map, of, switchMap, take } from 'rxjs';
import { selectAuthState, selectIsAuthenticated } from '../../store/auth/auth.selectors';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  // Fast-path on page refresh: the store resets to unauthenticated before
  // initializeApp$ has a chance to rehydrate it. Trust the token presence;
  // the server validates its expiry — the interceptor handles any 401.
  if (isBrowser && localStorage.getItem('access_token')) {
    return true;
  }

  return store.select(selectIsAuthenticated).pipe(
    take(1),
    map((isAuthenticated) => isAuthenticated || router.createUrlTree(['/auth/authenticate'])),
  );
};

export const redirectGuard: CanActivateFn = () => {
  const store = inject(Store);
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  const hasToken = isBrowser && !!localStorage.getItem('access_token');

  return store.select(selectIsAuthenticated).pipe(
    take(1),
    switchMap((isAuthenticated) => {
      if (!isAuthenticated && !hasToken) {
        return of(router.createUrlTree(['/auth/authenticate']));
      }

      return authService.getUserProfile().pipe(
        map((user) => {
          if (user.role === 'ADMIN') return router.createUrlTree(['/admin']);
          if (user.role === 'DOCTOR') return router.createUrlTree(['/doctor/dashboard']);
          if (user.role === 'PATIENT') return router.createUrlTree(['/patient/dashboard']);
          return router.createUrlTree(['/auth/authenticate']);
        }),
        catchError(() => of(router.createUrlTree(['/auth/authenticate']))),
      );
    }),
  );
};

export const selectAuthUser = createSelector(selectAuthState, (state) => state.user);

// Prevents logged-in users from accessing login/signup pages.
// Uses a localStorage fast-path because the store hasn't rehydrated yet on page refresh.
export const guestGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  if (!isBrowser || !localStorage.getItem('access_token')) {
    return true;
  }

  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.getUserProfile().pipe(
    map((user) => {
      if (user.role === 'ADMIN') return router.createUrlTree(['/admin']);
      if (user.role === 'DOCTOR') return router.createUrlTree(['/doctor/dashboard']);
      if (user.role === 'PATIENT') return router.createUrlTree(['/patient/dashboard']);
      return true;
    }),
    catchError(() => of(router.createUrlTree(['/auth/authenticate']))),
  );
};
