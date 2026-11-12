import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CoreApiClient } from '../api/core-api-client.service';
import { PollTemplateOptionDto } from '../api/dto';

@Injectable({
    providedIn: 'root',
})
export class PollTemplateOptionService {
    constructor(private readonly coreApiClient: CoreApiClient) {}

    public get(templateId: string, optionId: string): Observable<PollTemplateOptionDto> {
        return this.coreApiClient.getPollTemplateOption(templateId, optionId);
    }

    public create(templateId: string, value: string, order: number | null): Observable<PollTemplateOptionDto> {
        return this.coreApiClient.createPollTemplateOption(templateId, value, order);
    }

    public update(templateId: string, option: PollTemplateOptionDto): Observable<PollTemplateOptionDto> {
        return this.coreApiClient.updatePollTemplateOption(templateId, option);
    }

    public remove(templateId: string, optionId: string): Observable<void> {
        return this.coreApiClient.removePollTemplateOption(templateId, optionId);
    }
}
