import { FormControl } from '@angular/forms';

// Used by the signup component
export interface SignupForm {
  firstName:       FormControl<string>;
  lastName:        FormControl<string>;
  email:           FormControl<string>;
  password:        FormControl<string>;
  confirmPassword: FormControl<string>;
}

// Plain DTO sent to the backend
export interface SignupRequest {
  firstName: string;
  lastName:  string;
  email:     string;
  password:  string;
}