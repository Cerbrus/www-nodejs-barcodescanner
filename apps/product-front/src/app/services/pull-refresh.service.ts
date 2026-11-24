import { DestroyRef, Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

type Reload = () => Observable<unknown>;

@Injectable({ providedIn: 'root' })
export class PullRefreshService {
    private reload: Reload | undefined;

    public use(reload: Reload): void {
        this.reload = reload;
        inject(DestroyRef).onDestroy(() => {
            if (this.reload === reload) {
                this.reload = undefined;
            }
        });
    }

    public current(): Reload | undefined {
        return this.reload;
    }
}
