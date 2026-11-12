/*
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CoreApiClient } from '../api/core-api-client.service';
import { PollDto } from '../api/dto';
import { SlackApiClient } from '../api/slack-api-client.service';

@Injectable({
    providedIn: 'root',
})
export class PollService {
    constructor(private readonly coreApiClient: CoreApiClient, private readonly slackApiClient: SlackApiClient) {}

    public getPolls(status?: string, creatorId?: string): Observable<Array<PollDto>> {
        return this.coreApiClient.getPolls(status, creatorId);
    }

    public getPoll(pollId: string): Observable<PollDto> {
        return this.coreApiClient.getPoll(pollId);
    }

    public getPollChannel(pollId: string): Observable<string> {
        return this.slackApiClient.getPollChannel(pollId);
    }

    public finishPoll(pollId: string, channel: string): Observable<void> {
        return this.slackApiClient.finishPoll(pollId, channel);
    }

    public cancelPoll(pollId: string, channel: string, message: string | null): Observable<void> {
        return this.slackApiClient.cancelPoll(pollId, channel, message);
    }
}
*/
