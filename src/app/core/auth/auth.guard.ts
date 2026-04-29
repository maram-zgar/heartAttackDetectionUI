import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { map, take } from 'rxjs';
import { selectIsAuthenticated } from '../../store/auth/auth.selectors';

export const authGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  return store.select(selectIsAuthenticated).pipe(
    take(1),
    map((isAuthenticated) => {
      if (isAuthenticated) return true;
      if (isBrowser && localStorage.getItem('access_token')) return true;
      return router.createUrlTree(['/auth/authenticate']);
    })
  );
};

export const redirectGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  return store.select(selectIsAuthenticated).pipe(
    take(1),
    map((isAuthenticated) => {
      if (isAuthenticated || (isBrowser && localStorage.getItem('access_token'))) {
        // decode role from token to redirect correctly
        try {
          const token = localStorage.getItem('access_token')!;
          const payload = JSON.parse(atob(token.split('.')[1]));
          const authorities: string[] = payload.authorities ?? payload.roles ?? [];
          const role = authorities[0]?.replace('ROLE_', '');
          if (role === 'ADMIN') return router.createUrlTree(['/admin']);
          if (role === 'DOCTOR') return router.createUrlTree(['/doctor/dashboard']);
          if (role === 'PATIENT') return router.createUrlTree(['/patient/dashboard']);
        } catch { /* fall through */ }
      }
      return router.createUrlTree(['/auth/authenticate']);
    })
  );
};




// Add this to the bottom of auth.guard.ts

// Prevents logged-in users from accessing login/signup pages
export const guestGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  return store.select(selectIsAuthenticated).pipe(
    take(1),
    map((isAuthenticated) => {
      if (isAuthenticated || (isBrowser && localStorage.getItem('access_token'))) {
        // Already logged in — redirect away from auth pages
        try {
          const token = localStorage.getItem('access_token')!;
          const payload = JSON.parse(atob(token.split('.')[1]));
          const authorities: string[] = payload.authorities ?? payload.roles ?? [];
          const role = authorities[0]?.replace('ROLE_', '');
          if (role === 'ADMIN') return router.createUrlTree(['/admin']);
          if (role === 'DOCTOR') return router.createUrlTree(['/doctor/dashboard']);
          if (role === 'PATIENT') return router.createUrlTree(['/patient/dashboard']);
        } catch { /* fall through */ }
      }
      // Not logged in — allow access to login/signup
      return true;
    })
  );
};