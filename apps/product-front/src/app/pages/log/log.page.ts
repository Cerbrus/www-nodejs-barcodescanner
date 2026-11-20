import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { tap } from 'rxjs';

import { LogLine } from '../../models';
import { ApiService } from '../../services/api.service';
import { EventsService } from '../../services/events.service';

const MAX_LINES = 500;
const STICK_TO_BOTTOM_PIXELS = 40;

@Component({
    selector: 'app-log-page',
    standalone: true,
    imports: [DatePipe, RouterLink, TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './log.page.html',
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
