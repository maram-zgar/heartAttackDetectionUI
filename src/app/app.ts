import { Component, signal, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthActions } from './store/auth/auth.actions';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('CardioSense');
  private readonly store = inject(Store);

  ngOnInit(): void {
    // Initialize app - attempt to restore session if rememberMe was set
    this.store.dispatch(AuthActions.initializeApp());
  }
}
