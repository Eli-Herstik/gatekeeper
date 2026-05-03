import { Injectable, inject, DestroyRef, Signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Observable, share } from 'rxjs';
import type { ScanEvent } from '@core/models';

export type ConnectionState = 'idle' | 'live' | 'reconnecting' | 'closed';

export interface SseStream {
  events$: Observable<ScanEvent>;
  state$: Observable<ConnectionState>;
  toLatestEventSignal(): Signal<ScanEvent | undefined>;
  toStateSignal(): Signal<ConnectionState>;
  close(): void;
}

/**
 * Injectable EventSource wrapper.
 *
 * The native EventSource handles reconnection and Last-Event-ID automatically.
 * This service exposes the stream as both an Observable<ScanEvent> and a
 * signal helper. Consumers tear down by completing their subscription, or by
 * letting their DestroyRef close us.
 */
@Injectable({ providedIn: 'root' })
export class SseService {
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Open an SSE stream against the given URL. Each call returns its own stream
   * (and its own EventSource). Multiple consumers share() one connection.
   */
  open(url: string): SseStream {
    let source: EventSource | null = null;
    let closed = false;
    const stateObservers: Array<(s: ConnectionState) => void> = [];
    let currentState: ConnectionState = 'idle';

    const setState = (s: ConnectionState) => {
      currentState = s;
      stateObservers.forEach((obs) => obs(s));
    };

    const events$ = new Observable<ScanEvent>((sub) => {
      source = new EventSource(url, { withCredentials: true });
      setState('reconnecting');

      source.onopen = () => setState('live');
      source.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data) as ScanEvent;
          sub.next(data);
        } catch (err) {
          // Malformed payload — ignore individual event but keep stream alive.
          console.warn('[sse] malformed event', err);
        }
      };
      source.onerror = () => {
        // After an explicit close, the browser still fires onerror as it tears
        // the socket down. Skip the reconnecting blip in that case.
        if (closed) return;
        // EventSource auto-reconnects; surface "reconnecting" so the chrome bar
        // shows the warn dot. Browser switches us back to live on success.
        setState('reconnecting');
      };

      return () => {
        closed = true;
        if (source) {
          source.close();
          source = null;
        }
        setState('closed');
      };
    }).pipe(share(), takeUntilDestroyed(this.destroyRef));

    const state$ = new Observable<ConnectionState>((sub) => {
      sub.next(currentState);
      stateObservers.push((s) => sub.next(s));
      return () => {
        const i = stateObservers.findIndex((o) => o === sub.next);
        if (i >= 0) stateObservers.splice(i, 1);
      };
    });

    return {
      events$,
      state$,
      // Caller maintains accumulation; this helper only exposes the latest event.
      toLatestEventSignal: () => toSignal(events$),
      toStateSignal: () =>
        toSignal(state$, { initialValue: 'idle' as ConnectionState }),
      close: () => {
        closed = true;
        if (source) {
          source.close();
          source = null;
        }
        setState('closed');
      }
    };
  }
}
