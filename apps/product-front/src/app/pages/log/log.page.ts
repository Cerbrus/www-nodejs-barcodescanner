import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { tap } from 'rxjs';

import { LogLine } from '../../models';
import { ApiService } from '../../services/api.service';
import { EventsService } from '../../services/events.service';

const MAX_LINES = 500;
const STICK_TO_BOTTOM_PIXELS = 40;

@Component({
    selector: 'app-log-page',
    standalone: true,
    imports: [DatePipe, RouterLink, TranslateModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="terminal">
            <header class="bar">
                <a class="back" routerLink="/more" [attr.aria-label]="'nav.more' | translate">
                    <i class="material-symbols-outlined">arrow_back</i>
                </a>
                <span class="dot red"></span>
                <span class="dot amber"></span>
                <span class="dot green"></span>
                <span class="title">barcodescanner — log</span>
                <span class="status" [class.live]="events.connected()">
                    {{ (events.connected() ? 'log.live' : 'log.disconnected') | translate }}
                </span>
            </header>
            <div #screen class="screen" (scroll)="onScroll()">
                @for (line of lines(); track line.id) {
                    <div class="line" [class]="line.level">
                        <span class="time">{{ line.time | date: 'HH:mm:ss' }}</span>
                        <span class="source" [class]="line.source">{{ line.source }}</span>
                        <span class="message">{{ line.message }}</span>
                    </div>
                } @empty {
                    <div class="line"><span class="message dim">{{ 'log.empty' | translate }}</span></div>
                }
                <div class="line"><span class="prompt">$</span><span class="cursor"></span></div>
            </div>
        </div>
    `,
    styleUrl: './log.page.scss'
})
export class LogPage {
    protected readonly events = inject(EventsService);
    protected readonly lines = signal<Array<LogLine>>([]);

    private readonly screen = viewChild.required<ElementRef<HTMLElement>>('screen');
    private stickToBottom = true;

    constructor() {
        inject(ApiService)
            .getLogs()
            .pipe(
                tap((lines) => this.lines.set(lines)),
                takeUntilDestroyed()
            )
            .subscribe();

        this.events
            .on<LogLine>('log')
            .pipe(
                tap((line) => this.lines.update((lines) => [...lines, line].slice(-MAX_LINES))),
                takeUntilDestroyed()
            )
            .subscribe();

        effect(() => {
            this.lines();
            if (this.stickToBottom) {
                requestAnimationFrame(() => this.scrollToBottom());
            }
        });
    }

    protected onScroll(): void {
        const element = this.screen().nativeElement;
        this.stickToBottom = element.scrollHeight - element.scrollTop - element.clientHeight < STICK_TO_BOTTOM_PIXELS;
    }

    private scrollToBottom(): void {
        const element = this.screen().nativeElement;
        element.scrollTop = element.scrollHeight;
    }
}
