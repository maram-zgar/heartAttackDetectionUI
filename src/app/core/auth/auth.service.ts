import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserProfile } from '../../shared/models/user-profile.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly baseUrl = '/api/v1/auth';
  private accessToken: string | null = this.isBrowser ? localStorage.getItem('access_token') : null;

  authenticate(request: { email: string; password: string }): Observable<{ accessToken: string; refreshToken: string }> {
    // Clear any stale/expired tokens before attempting login
    // This prevents the JwtAuthenticationFilter from crashing on expired tokens
    // this.clearTokens();
    
    return this.http.post<{ accessToken: string; refreshToken: string }>(
      `${this.baseUrl}/authenticate`,
      { email: request.email, password: request.password }
    );
  }

  signup(request: { firstName: string; lastName: string; email: string; password: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/register`, {
      firstName: request.firstName,
      lastName: request.lastName,
      email: request.email,
      password: request.password,
    });
  }
  
  logout(): Observable<any> {
    localStorage.clear();
    return this.http.post(`${this.baseUrl}/logout`, {});
  }
  
  // Calls GET /api/v1/auth/me to retrieve the current user's profile info (id, email, name, role)
  getUserProfile(): Observable<UserProfile> {
    const token = this.getAccessToken();
    return this.http.get<UserProfile>(`${this.baseUrl}/me`, {
      headers: new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` }),
    });
  }

  refreshToken(): Observable<{ accessToken: string; refreshToken?: string }> {
    const token = this.getRefreshToken();
    return this.http.post<{ accessToken: string; refreshToken?: string }>(
      `${this.baseUrl}/refresh-token`,
      {},
      { headers: new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` }) }
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

  changePassword(request: { currentPassword: string; newPassword: string }): Observable<any> {
    const token = this.getAccessToken();
    return this.http.post(`${this.baseUrl}/change-password`, {
      currentPassword: request.currentPassword,
      newPassword: request.newPassword,
    }, {
      headers: new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` }),
    });
  }

  // add access token to headers and call PUT /api/v1/auth/update-profile to update firstName and lastName
  updateProfile(request: { firstName: string; lastName: string; hospital: string }): Observable<UserProfile> {
    const token = this.getAccessToken();
    return this.http.put<UserProfile>(`${this.baseUrl}/update-profile`, {
      firstName: request.firstName,
      lastName: request.lastName,
      hospital: request.hospital,
    }, {
      headers: new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` }),
    });
  }
}