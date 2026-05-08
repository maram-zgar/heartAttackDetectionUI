import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { definePreset } from '@primeng/themes';

import { routes } from './app.routes';
import { authReducer } from './store/auth/auth.reducer';
import { AuthEffects } from './store/auth/auth.effects';
import { authInterceptor } from './core/auth/auth.interceptor';

const emeraldPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{emerald.50}',
      100: '{emerald.100}',
      200: '{emerald.200}',
      300: '{emerald.300}',
      400: '{emerald.400}',
      500: '{emerald.500}',
      600: '{emerald.600}',
      700: '{emerald.700}',
      800: '{emerald.800}',
      900: '{emerald.900}',
      950: '{emerald.950}',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    provideAnimationsAsync(),

    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor])
    ),

    provideStore({
      auth: authReducer,
    }),

    provideEffects([AuthEffects]),

    provideStoreDevtools({
      maxAge: 25,
      logOnly: false, // set true for production
    }),

    providePrimeNG({
      theme: {
        preset: emeraldPreset,
        options: {
          darkModeSelector: '.dark-mode',
        },
      },
    }),
  ],
};
