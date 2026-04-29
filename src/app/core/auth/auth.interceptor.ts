// attaches the JWT token to the header of each request, handles 401 errors by redirecting to the login page

import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { catchError, switchMap, throwError, tap } from 'rxjs';
import { AuthService } from './auth.service';
import { AuthActions } from '../../store/auth/auth.actions';
import { JwtDecoder } from '../utils/jwt.decoder';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const store = inject(Store);

  const isRefreshRequest = req.url.includes('/auth/refresh-token');

  const token = !isRefreshRequest ? authService.getAccessToken() : null;

  interface AuthResponse {
    accessToken: string;
    refreshToken?: string;
  }
  
  console.log('[INTERCEPTOR] URL:', req.url);
  console.log('[INTERCEPTOR] Token exists:', !!token);
  if (token) {
    console.log('[INTERCEPTOR] Token preview:', token.substring(0, 20) + '...');
    // Decode to show claims being sent
    const tokenInfo = JwtDecoder.getTokenInfo(token);
    if (tokenInfo.isValid) {
      console.log('[INTERCEPTOR] Token role:', tokenInfo.role);
      console.log('[INTERCEPTOR] Token authorities:', JSON.stringify(tokenInfo.authorities));
      console.log('[INTERCEPTOR] Token expired:', tokenInfo.isExpired);
    } else {
      console.warn('[INTERCEPTOR] Token is invalid or could not be decoded');
    }
  }

  // Attach Bearer token if available
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('[INTERCEPTOR] Error:', error.status, error.statusText);
      console.error('[INTERCEPTOR] Error URL:', req.url);
      console.error('[INTERCEPTOR] Error response:', error.error);
      
      // On 401, try refresh — skip if it's the refresh endpoint itself
      if (error.status === 401 && !isRefreshRequest) {
        console.log('[INTERCEPTOR] Got 401, attempting token refresh...');
        return authService.refreshToken().pipe(
          tap((res) => {
            // Update localStorage immediately
            const currentRefresh = authService.getRefreshToken();
            authService.setTokens(
              res.accessToken, 
              res.refreshToken ?? currentRefresh!, true);
            
            // Update NgRx store so the rest of the app knows we're refreshed
            store.dispatch(AuthActions.refreshTokenSuccess({ accessToken: res.accessToken, refreshToken: res.refreshToken!, }));
          }),
          switchMap((res) => next(req.clone({
            setHeaders: { Authorization: `Bearer ${res.accessToken}` },
          }))),
          catchError((refreshError) => {
            store.dispatch(AuthActions.logout());
            return throwError(() => refreshError);
          })
        );
      }
      return throwError(() => error);
    })
  );
};