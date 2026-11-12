import { Controller, MessageEvent, Module, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';

import { EventsService } from './events.service';

@Controller({ path: 'events', version: '1' })
export class EventsController {
    constructor(private readonly events: EventsService) {
    }

    @Sse()
    public stream(): Observable<MessageEvent> {
        return this.events.stream();
    }
}

@Module({
    controllers: [EventsController],
    providers: [EventsService],
    exports: [EventsService]
})
export class EventsModule {
}
