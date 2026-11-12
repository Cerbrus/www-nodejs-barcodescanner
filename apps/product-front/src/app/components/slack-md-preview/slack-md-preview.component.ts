import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-slack-md-preview',
    standalone: true,
    templateUrl: './slack-md-preview.component.html',
    styleUrl: './slack-md-preview.component.scss'
})
export class SlackMdPreviewComponent {
    @Input({ required: true })
    public set value(value: string) {
        this.parsedInput = this.replacements.reduce(
            (acc, { search, replacement }) => acc.replace(search, replacement),
            value
        );
    }

    protected parsedInput!: string;

    private replacements = [
        // Link
        { search: /<([^|]+)(?:\|(.+))?>/g, replacement: '<a href="$1" class="underline">$2</a>' },
        { search: /<a href="(.+)" class="underline"><\/a>/g, replacement: '<a href="$1" class="underline">$1</a>' },

        { search: /\\r/g, replacement: '\r' }, // Return
        { search: /\\n/g, replacement: '\n' }, // Newline

        { search: /```[\r\n]*?([^`]+)```/g, replacement: '<div class="code">$1</div>' }, // Code block
        { search: /`([^`]+)`/g, replacement: '<span class="code">$1</span>' }, // Inline Code

        // Unordered list
        { search: /^- ([^\r\n]*)/g, replacement: '<uli>$1</uli>' },
        { search: /<uli>/, replacement: '<ul class="list-disc pl-6"><uli>' },
        { search: /<\/uli>/g, replacement: '</uli></ul>' },
        { search: /<\/ul>([\r\n]*)<uli>/g, replacement: '<uli>' },
        { search: /uli>/g, replacement: 'li>' },

        // Ordered list
        { search: /^\* ([^\r\n]*)/g, replacement: '<oli>$1</oli>' },
        { search: /<oli>/, replacement: '<ol class="list-decimal pl-6"><oli>' },
        { search: /<\/oli>/g, replacement: '</oli></ol>' },
        { search: /<\/ol>([\r\n]*)<oli>/g, replacement: '<oli>' },
        { search: /oli>/g, replacement: 'li>' },

        { search: /\*([^*]+)+\*/g, replacement: '<b>$1</b>' }, // Bold
        { search: /_([^~]+)_/g, replacement: '<i>$1</i>' }, // Italic
        { search: /~([^~]+)~/g, replacement: '<s>$1</s>' }, // Strike-through

        { search: /^[\r\n]*/, replacement: '' }, // Trim leading newlines
        { search: /[\r\n]*$/, replacement: '' } // Trim trailing newlines
    ];
}
