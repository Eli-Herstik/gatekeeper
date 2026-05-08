import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';
import { ConfigurationService } from './app/core/services/configuration.service';

async function bootstrap() {
  if (environment.enableMocks) {
    const { worker } = await import('./test/msw/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: '/mockServiceWorker.js' }
    });
  }
  await ConfigurationService.load();
  await bootstrapApplication(AppComponent, appConfig);
}

bootstrap().catch((err) => console.error('Bootstrap failed:', err));
