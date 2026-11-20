import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    ViewEncapsulation,
    afterRenderEffect,
    computed,
    inject,
    input
} from '@angular/core';
import { Marked, Tokens } from 'marked';

const escape = (text: string): string =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const marked = new Marked({
    gfm: true,
    breaks: true,
    renderer: {
        html: (token: Tokens.HTML | Tokens.Tag): string => escape(token.text),
        image: (token: Tokens.Image): string => escape(token.text || token.href)
    }
});

@Component({
    selector: 'app-markdown',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './markdown.component.html',
    styleUrl: './markdown.component.scss'
})
export class MarkdownComponent {
    public readonly text = input.required<string>();

    protected readonly html = computed(() => marked.parse(this.text(), { async: false }));

    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

    constructor() {
        afterRenderEffect(() => {
            this.html();
            this.host.nativeElement.querySelectorAll('a').forEach((link) => {
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
            });
        });
    }
}
