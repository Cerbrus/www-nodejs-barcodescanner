import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { NamingPromptComponent } from '../../components/naming-prompt/naming-prompt.component';
import { ShoppingStore } from '../../services/shopping.store';

@Component({
    selector: 'app-inbox-page',
    standalone: true,
    imports: [DatePipe, TranslatePipe, NamingPromptComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './inbox.page.html'
})
export class InboxPage {
    protected readonly store = inject(ShoppingStore);
    protected readonly namingCode = signal<string | undefined>(undefined);
}
