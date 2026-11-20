import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CameraAccessService {
    private grantedInThisLoad = false;

    public get granted(): boolean {
        return this.grantedInThisLoad;
    }

    public markGranted(): void {
        this.grantedInThisLoad = true;
    }
}
