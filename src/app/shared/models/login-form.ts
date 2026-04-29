import { FormControl } from "@angular/forms";

export interface LoginForm {
  email: FormControl<string>;
  password: FormControl<string>;
  rememberMe: FormControl<boolean>;
}

// Plain DTO sent to the backend
export interface LoginRequest {
  email:      string;
  password:   string;
  rememberMe?: boolean;
}

const example = {
    email: "hello",
    password: "world",
}

const example2 = {
    ...example,
    rememberMe: false,
}
