import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { map, Observable } from 'rxjs';
import { SettingsService } from '../settings/settings.service';
import { BaseApiClient } from './base-api-client';
import { SlackChannelDto } from './dto/poll/slack-channel.dto';
import { SlackPollDto } from './dto/poll/slack-poll.dto';

@Injectable({
    providedIn: 'root',
})
export class SlackApiClient extends BaseApiClient {
    constructor(httpService: HttpClient, settings: SettingsService) {
        super(httpService, settings, 'slack');
    }

    public startPoll(templateId: string, channelId: string): Observable<{ id: string }> {
        return this.put<{ id: string }>('/poll/start', { templateId, channelId });
    }

    public finishPoll(pollId: string, channelId: string): Observable<void> {
        return this.put<void>('/poll/finish', { pollId, channelId });
    }

    public cancelPoll(pollId: string, channelId: string, message: string | null): Observable<void> {
        return this.put<void>('/poll/cancel', { pollId, channelId, message });
    }

    public getChannels(): Observable<Array<SlackChannelDto>> {
        return this.get<Array<SlackChannelDto>>('/slack/channels');
    }

    public getPollChannel(pollId: string): Observable<string> {
        return this.get<SlackPollDto>(`/poll/${pollId}`).pipe(map((poll) => poll.channelId));
    }
}
