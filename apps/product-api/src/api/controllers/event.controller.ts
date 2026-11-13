import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';

import { EventsService } from '../../core/services/events.service';

@Controller({ path: 'events', version: '1' })
export class EventController {
    constructor(private readonly events: EventsService) {
    }

    @Sse()
    public stream(): Observable<MessageEvent> {
        return this.events.stream();
    }
}
