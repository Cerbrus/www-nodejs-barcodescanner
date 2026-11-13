import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, interval, map, merge } from 'rxjs';

export type AppEventType = 'scan' | 'list' | 'barcode' | 'catalog' | 'log' | 'feedback' | 'feedback_settings';

const HEARTBEAT_MILLISECONDS = 25000;

@Injectable()
export class EventsService {
    private readonly events$ = new Subject<MessageEvent>();

    public emit(type: AppEventType, data: object): void {
        this.events$.next({ type, data });
    }

    public stream(): Observable<MessageEvent> {
        const heartbeat$ = interval(HEARTBEAT_MILLISECONDS).pipe(
            map((): MessageEvent => ({ type: 'ping', data: {} }))
        );

        return merge(this.events$, heartbeat$);
    }
}
