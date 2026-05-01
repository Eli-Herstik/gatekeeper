import { Injectable, signal } from '@angular/core';

export interface CurrentUser {
  username: string;
  display_name: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Session-based auth — backend hydrates this on first call. Stubbed for now.
  readonly currentUser = signal<CurrentUser>({
    username: 'jchen',
    display_name: 'Jamie Chen',
    email: 'jchen@contoso.com'
  });
}
