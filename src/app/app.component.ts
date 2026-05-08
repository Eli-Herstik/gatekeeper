import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificationsService } from './core/services/notifications.service';
import { ConfigurationService } from './core/services/configuration.service';
import { ToastHostComponent } from './shared/ui/toast-host.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastHostComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet></router-outlet>
    <app-toast-host></app-toast-host>
  `
})
export class AppComponent implements OnInit {
  private readonly notifications = inject(NotificationsService);
  private readonly config = inject(ConfigurationService);

  ngOnInit(): void {
    this.notifications.start(this.config.apiBase);
  }
}
