import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {ToastComponent} from './shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  standalone: true
})
export class AppComponent {
  title = 'Pixly';
}
