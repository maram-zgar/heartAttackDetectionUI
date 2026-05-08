import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { createSelector, Store } from '@ngrx/store';
import { combineLatest, filter, map, take, timeout } from 'rxjs';
import { selectAuthState, selectIsAuthenticated } from '../../store/auth/auth.selectors';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  return store.select(selectIsAuthenticated).pipe(
    filter((isAuthenticated) => isAuthenticated), // Wait for auth state to be determined
    map((isAuthenticated) => {
      if (isAuthenticated) return true;
      if (isBrowser && localStorage.getItem('access_token')) return true;
      return router.createUrlTree(['/auth/authenticate']);
    }),
    take(1),
  );
};

export const redirectGuard: CanActivateFn = () => {
  const store = inject(Store);
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  return store.select(selectIsAuthenticated).pipe(
    take(1),
    map((isAuthenticated) => {
      if (isAuthenticated || (isBrowser && localStorage.getItem('access_token'))) {
        // get the role from /me endpoint and redirect to the appropriate dashboard without decoding teh token on the client side
        try {
          const token = localStorage.getItem('access_token')!;
          authService.getUserProfile().subscribe((user) => {
          const role = user.role;
          if (role === 'ADMIN') return router.createUrlTree(['/admin']);
          if (role === 'DOCTOR') return router.createUrlTree(['/doctor/dashboard']);
          if (role === 'PATIENT') return router.createUrlTree(['/patient/dashboard']);
          return router.createUrlTree(['/auth/authenticate']);
          });
        } catch {}
      }
      return router.createUrlTree(['/auth/authenticate']);
    })
  );
};

export const selectAuthUser = createSelector(selectAuthState, (state) => state.user);

// Prevents logged-in users from accessing login/signup pages
export const guestGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);

  return combineLatest([
    store.select(selectIsAuthenticated),
    store.select(selectAuthUser), // the UserProfile from your reducer
  ]).pipe(
    take(1),
    map(([isAuthenticated, user]) => {
      if (!isAuthenticated || !user) return true; // not logged in — allow

      // Use the role from the store, not from decoding a JWT
      if (user.role === 'ADMIN') return router.createUrlTree(['/admin']);
      if (user.role === 'DOCTOR') return router.createUrlTree(['/doctor/dashboard']);
      if (user.role === 'PATIENT') return router.createUrlTree(['/patient/dashboard']);
      return true;
    })
  );
};