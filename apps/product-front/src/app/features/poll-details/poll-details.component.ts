/*
import { DatePipe } from '@angular/common';
import { Component, DestroyRef, HostBinding, HostListener, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { combineLatest, firstValueFrom, switchMap } from 'rxjs';
import { catchError, filter, tap } from 'rxjs/operators';
import { SlackMdPreviewComponent } from '../../components/slack-md-preview/slack-md-preview.component';
import { RelativeDatePipe } from '../../pipes/relative-date.pipe';
import { SlackChannelDto } from '../../services/api/dto/poll/slack-channel.dto';
import { SlackApiClient } from '../../services/api/slack-api-client.service';
import { PollEntity } from '../../services/poll/poll.entity';
import { PollService } from '../../services/poll/poll.service';
import { FormsModule } from '@angular/forms';

const DetailKeys = ['id', 'creatorId', 'question', 'created', 'modified', 'status', 'started', 'closed'] as const;
type DetailKey = (typeof DetailKeys)[number];

@Component({
    selector: 'app-poll-details',
    standalone: true,
    imports: [TranslateModule, RouterLink, SlackMdPreviewComponent, FormsModule],
    providers: [DatePipe],
    templateUrl: './poll-details.component.html',
    styl eUrl: './poll-details.component.scss'
})
export class PollDetailsComponent implements OnInit {
    @HostBinding('class.open') protected isOpen = false;
    protected entity: PollEntity | null = null;

    protected detailRows = DetailKeys;
    protected channel!: SlackChannelDto;

    constructor(
        private readonly route: ActivatedRoute,
        private readonly router: Router,
        private readonly pollService: PollService,
        private readonly slackApiClient: SlackApiClient,
        private readonly relativeDatePipe: RelativeDatePipe,
        private readonly destroyRef: DestroyRef,
        private readonly translate: TranslateService
    ) {
    }

    public ngOnInit(): void {
        this.route.params
            .pipe(
                filter((params) => !!params?.['id'] && params['id'] !== 'overview'),
                switchMap((params) =>
                    combineLatest(
                        this.pollService.getPoll(params['id']),
                        this.pollService.getPollChannel(params['id']),
                        this.slackApiClient.getChannels()
                    )
                ),
                catchError((error) => {
                    console.error(error);
                    this.router.navigate(['products']);
                    return [];
                }),
                tap(([dto]) => {
                    this.isOpen = !!dto;
                }),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(([dto, channel, channels]) => {
                if (!dto) return;

                this.channel = channels.find((c) => c.id === channel)!;
                this.entity = PollEntity.fromDto(dto);
            });
    }

    protected async stopPoll(cancelled: boolean): Promise<void> {
        if (
            !this.entity ||
            !confirm(
                this.translate.instant(
                    cancelled ? 'PollDetailsComponent.confirmCancelPoll' : 'PollDetailsComponent.confirmFinishPoll',
                    this.entity
                )
            )
        ) {
            return;
        }

        let message: string | null = null;
        if (cancelled) {
            message = prompt(this.translate.instant('PollDetailsComponent.cancelPollMessage'));
        }

        const request = cancelled
            ? this.pollService.cancelPoll(this.entity!.id, this.channel.id, message)
            : this.pollService.finishPoll(this.entity!.id, this.channel.id);

        await firstValueFrom(request).then(() => {
            this.router.navigate(['products'], { state: { refresh: true } });
        });
    }

    @HostListener('document:keydown.escape', ['$event'])
    protected closeDetails(): void {
        this.router.navigate(['products']);
        this.entity = null;
    }

    protected formatValue(value: PollEntity[DetailKey]): string {
        return !value ? '-' : value instanceof Date ? this.relativeDatePipe.transform(value) ?? '' : value;
    }
}
*/
