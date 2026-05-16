import { Routes } from '@angular/router';
import { authGuard, redirectGuard } from './core/auth/auth.guard';
import { EmptyComponent } from './empty/empty';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('./core/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },

  // Admin Dashboard
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/dashboard/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent
      ),
    canActivate: [authGuard],
  },

  // Doctor Dashboard
  {
    path: 'doctor/dashboard',
    loadComponent: () =>
      import('./features/doctor/doctor-dashboard.component').then(
        (m) => m.DoctorDashboardComponent
      ),
    canActivate: [authGuard],
  },

// Patient Dashboard
  {
    path: 'patient/dashboard',
    loadComponent: () =>
      import('./features/patient/patient-dashboard.component').then(
        (m) => m.PatientDashboardComponent
      ),
    canActivate: [authGuard],
  },



  {
    path: '',
    component: EmptyComponent,
    canActivate: [redirectGuard]
  },
  {
    path: '**',
    redirectTo: '',
  },
];
