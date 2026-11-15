import { Controller, MessageEvent, Req, Sse } from '@nestjs/common';
import { Observable, concat, filter, from, interval, takeUntil } from 'rxjs';

import { AppConfig } from '../../config/app.config';
import { EventsService } from '../../core/services/events.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { SessionService } from '../../core/services/session.service';
import { Agent } from '../guards/agent.decorator';
import { CalledBy } from '../guards/caller.decorator';
import { Caller, HttpRequest, cookieHeader } from '../http';

const SESSION_CHECK_MILLISECONDS = 60 * 1000;

@Controller({ path: 'events', version: '1' })
export class EventController {
    constructor(
        private readonly events: EventsService,
        private readonly sessions: SessionService,
        private readonly feedback: FeedbackService,
        private readonly config: AppConfig
    ) {}

    @Agent()
    @Sse()
    public stream(@Req() request: HttpRequest, @CalledBy() caller: Caller): Observable<MessageEvent> {
        if (caller === 'agent') {
            const announcement$ = from(this.feedback.takeUpdateAnnouncement()).pipe(
                filter((event): event is MessageEvent => event !== undefined)
            );

            return concat(announcement$, this.events.stream());
        }
        if (!this.config.loginEnabled) {
            return this.events.stream();
        }

        const sessionEnded$ = interval(SESSION_CHECK_MILLISECONDS).pipe(
            filter(() => !this.sessions.read(cookieHeader(request)))
        );

        return this.events.stream().pipe(takeUntil(sessionEnded$));
    }
}
