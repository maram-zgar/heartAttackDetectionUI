import { createReducer, on } from '@ngrx/store';
import { AuthActions, AuthUser } from './auth.actions';
import { UserProfile } from '../../shared/models/user-profile.model';

export interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  rememberMe: boolean;
}

export const initialAuthState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  loading: false,
  error: null,
  isAuthenticated: false,
  rememberMe: false,
};

export const authReducer = createReducer(
  initialAuthState,

  // App initialization
  on(AuthActions.initializeApp, (state) => state),

  // Login
  on(AuthActions.login, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(AuthActions.loginSuccess, (state, { accessToken, refreshToken, rememberMe }) => ({
    ...state,
    loading: true,
    accessToken,
    refreshToken: refreshToken ?? null,
    isAuthenticated: true,
    error: null,
    rememberMe,
  })),
  on(AuthActions.loginFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
    isAuthenticated: false,
  })),

  // Signup
  on(AuthActions.signup, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(AuthActions.signupSuccess, (state, { accessToken, refreshToken, rememberMe }) => ({
    ...state,
    loading: false,
    accessToken,
    refreshToken: refreshToken ?? null,
    isAuthenticated: true,
    error: null,
    rememberMe,
  })),
  on(AuthActions.signupFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
    isAuthenticated: false,
  })),

  // Logout
  on(AuthActions.logoutSuccess, () => ({
    ...initialAuthState,
  })),

  // Token refresh
  on(AuthActions.refreshTokenSuccess, (state, { accessToken }) => ({
    ...state,
    accessToken,
    isAuthenticated: true,
  })),
  on(AuthActions.refreshTokenFailure, () => ({
    ...initialAuthState,
  })),

  // Clear error
  on(AuthActions.clearError, (state) => ({
    ...state,
    error: null,
  })),

  on(AuthActions.loadProfileSuccess, (state, { profile }) => ({
  ...state,
  user: profile,
  loading: false,
})),

on(AuthActions.loadProfileFailure, (state, { error }) => ({
  ...state,
  loading: false,
  error,
}))
);