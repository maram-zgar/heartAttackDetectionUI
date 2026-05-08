import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Store } from '@ngrx/store';
import { switchMap, take } from 'rxjs';
import { selectAccessToken } from '../../store/auth/auth.selectors';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(Store);
  const platformId = inject(PLATFORM_ID);

  const isBrowser = isPlatformBrowser(platformId);

  // Skip refresh endpoint
  if (req.url.includes('/auth/refresh-token')) {
    return next(req);
  }

  return store.select(selectAccessToken).pipe(
    take(1),
    switchMap((storeToken) => {

      // ✅ FALLBACK TO LOCALSTORAGE AFTER PAGE REFRESH
      const localToken = isBrowser
        ? localStorage.getItem('access_token')
        : null;

      const token = storeToken || localToken;

      console.log('[INTERCEPTOR] token exists:', !!token);

      if (token) {
        req = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      return next(req);
    })
  );
};