import { createActionGroup, emptyProps, props, createAction } from '@ngrx/store';
import { LoginRequest as LoginRequestModel }   from '../../shared/models/login-form';
import { SignupRequest as SignupRequestModel }  from '../../shared/models/signup-form';
import { UserProfile }    from '../../shared/models/user-profile.model';

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  dateOfBirth?: string;
  gender?: string;
  role?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export const AuthActions = createActionGroup({
  source: 'Auth',
  events: {
    // App initialization
    'Initialize App': emptyProps(),

    // Login
    'Login': props<{ request: LoginRequestModel }>(),
    'Login Success': props<{ accessToken: string; refreshToken: string; rememberMe: boolean }>(),
    'Login Failure': props<{ error: string }>(),

    // Signup
    'Signup': props<{ request: SignupRequestModel }>(),
    'Signup Success': props<{ accessToken: string; refreshToken?: string; rememberMe: boolean }>(),
    'Signup Failure': props<{ error: string }>(),

    // User profile (fetched after login via /me)
    'Load Profile Success': props<{ profile: UserProfile }>(),
    'Load Profile Failure': props<{ error: string }>(),

    // Logout
    'Logout': emptyProps(),
    'Logout Success': emptyProps(),

    // Token refresh
    'Refresh Token': emptyProps(),
    'Refresh Token Success': props<{ accessToken: string; refreshToken: string }>(),
    'Refresh Token Failure': emptyProps(),

    // Clear error
    'Clear Error': emptyProps(),
  },
});

export const rehydrateAuth = createAction(
  '[Auth] Rehydrate Auth',
  props<{ 
    accessToken: string; 
    refreshToken: string | null; 
    rememberMe: boolean 
  }>()
);