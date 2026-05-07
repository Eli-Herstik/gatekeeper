import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

async function bootstrap() {
  if (environment.enableMocks) {
    const { worker } = await import('./test/msw/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: '/mockServiceWorker.js' }
    });
  }
  await bootstrapApplication(AppComponent, appConfig);
}

bootstrap().catch((err) => console.error(err));
