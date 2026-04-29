import { Routes } from '@angular/router';
import { guestGuard } from './auth.guard';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    canActivate: [guestGuard],
    children: [
      {
        path: 'authenticate',
        loadComponent: () =>
          import('../../features/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'signup',
        loadComponent: () =>
          import('../../features/signup/signup.component').then((m) => m.SignupComponent),
      },
      {
        path: '',
        redirectTo: 'authenticate',
        pathMatch: 'full',
      },
    ],
  },
];