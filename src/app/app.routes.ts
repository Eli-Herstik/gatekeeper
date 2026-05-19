import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';
import { authGuard } from './core/guards/auth.guard';

export const appRoutes: Routes = [
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/scans/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          )
      },
      {
        path: 'scans/new',
        loadComponent: () =>
          import('./features/scans/new-scan/new-scan.component').then(
            (m) => m.NewScanComponent
          )
      },
      {
        path: 'scans/:id',
        loadComponent: () =>
          import('./features/scans/scan-detail/scan-detail.component').then(
            (m) => m.ScanDetailComponent
          )
      },
      {
        path: 'scans/:id/submit',
        loadComponent: () =>
          import('./features/scans/submit/submit.component').then(
            (m) => m.SubmitComponent
          )
      },
      {
        path: 'apps/:appId',
        loadComponent: () =>
          import('./features/apps/history/history.component').then(
            (m) => m.HistoryComponent
          )
      },
      {
        path: 'apps/:appId/scans/new',
        loadComponent: () =>
          import('./features/scans/new-scan/new-scan.component').then(
            (m) => m.NewScanComponent
          )
      }
    ]
  }
];
