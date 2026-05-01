import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Stub auth interceptor — the real backend uses cookie-based session auth so
 * we just pass `withCredentials`. Token-based flows can layer on later.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req.clone({ withCredentials: true }));
};
