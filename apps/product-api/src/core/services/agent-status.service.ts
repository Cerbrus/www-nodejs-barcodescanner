import { Injectable } from '@nestjs/common';

import { EventsService } from './events.service';

export type ScannerState = 'connected' | 'waiting';

export interface AgentStatus {
    agentOnline: boolean;
    agentSeenAt?: string;
    scanner?: ScannerState;
    device?: string;
}

const ONLINE_WITHIN_MILLISECONDS = 150 * 1000;

@Injectable()
export class AgentStatusService {
    private seenAt?: Date;
    private scanner?: ScannerState;
    private device?: string;

    constructor(private readonly events: EventsService) {
    }

    public get status(): AgentStatus {
        const agentOnline = this.seenAt !== undefined && Date.now() - this.seenAt.getTime() < ONLINE_WITHIN_MILLISECONDS;

        return {
            agentOnline,
            agentSeenAt: this.seenAt?.toISOString(),
            scanner: agentOnline ? this.scanner : undefined,
            device: agentOnline ? this.device : undefined
        };
    }

    public report(scanner: ScannerState, device?: string): void {
        const changed = scanner !== this.scanner || !this.status.agentOnline;
        this.seenAt = new Date();
        this.scanner = scanner;
        this.device = device;
        if (changed) {
            this.events.emit('agent', this.status);
        }
    }
}
