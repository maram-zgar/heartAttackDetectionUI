import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserProfile } from '../../shared/models/user-profile.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http       = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser  = isPlatformBrowser(this.platformId);
  private readonly baseUrl    = 'http://localhost:8080/api/v1/auth';

  authenticate(request: { email: string; password: string }): Observable<{ accessToken: string; refreshToken: string }> {
    return this.http.post<{ accessToken: string; refreshToken: string }>(
      `${this.baseUrl}/authenticate`,
      { email: request.email, password: request.password },
    );
  }

  signup(request: { firstName: string; lastName: string; email: string; password: string }): Observable<{ accessToken: string; refreshToken: string }> {
    return this.http.post<{ accessToken: string; refreshToken: string }>(`${this.baseUrl}/register`, request);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, {});
  }

  /**
   * Fetches the current user's profile from /me.
   *
   * Pass `bearerToken` explicitly when you already hold the exact valid token
   * (e.g. right after a refresh in initializeApp$). This bypasses any
   * store/localStorage timing dependency and guarantees the right token is used.
   *
   * When called without a token the interceptor injects the header from the store.
   */
  getUserProfile(bearerToken?: string): Observable<UserProfile> {
    if (bearerToken) {
      return this.http.get<UserProfile>(`${this.baseUrl}/me`, {
        headers: new HttpHeaders({ Authorization: `Bearer ${bearerToken}` }),
      });
    }
    return this.http.get<UserProfile>(`${this.baseUrl}/me`);
  }

  /**
   * Calls /refresh-token with the stored refresh token in the Authorization header.
   * The interceptor skips this endpoint so the header must be set manually.
   */
  refreshToken(): Observable<{ accessToken: string; refreshToken?: string }> {
    return this.http.post<{ accessToken: string; refreshToken?: string }>(
      `${this.baseUrl}/refresh-token`,
      {},
      { headers: new HttpHeaders({ Authorization: `Bearer ${this.getRefreshToken() ?? ''}` }) },
    );
  }

  getAccessToken(): string | null {
    return this.isBrowser ? localStorage.getItem('access_token') : null;
  }

  getRefreshToken(): string | null {
    return this.isBrowser ? localStorage.getItem('refresh_token') : null;
  }

  hasRefreshToken(): boolean {
    return !!this.getRefreshToken();
  }

  setTokens(accessToken: string, refreshToken: string, rememberMe: boolean): void {
    if (!this.isBrowser) return;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('rememberMe', rememberMe ? 'true' : 'false');
  }

  clearTokens(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('rememberMe');
  }

  changePassword(request: { currentPassword: string; newPassword: string }): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/change-password`, request);
  }

  updateProfile(request: { firstName: string; lastName: string }): Observable<UserProfile> {
    return this.http.put<UserProfile>(`${this.baseUrl}/update-profile`, request);
  }
}
