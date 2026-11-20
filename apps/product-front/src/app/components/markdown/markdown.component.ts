import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { parseMarkdown } from './markdown';

@Component({
    selector: 'app-markdown',
    standalone: true,
    imports: [NgTemplateOutlet],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './markdown.component.html',
    styleUrl: './markdown.component.scss'
})
export class MarkdownComponent {
    public readonly text = input.required<string>();

    protected readonly blocks = computed(() => parseMarkdown(this.text()));
}
