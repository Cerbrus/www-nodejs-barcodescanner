import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    computed,
    effect,
    input,
    output,
    signal,
    viewChild
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { Cut, MOST_ZOOM, Size, WHOLE, cutRegion, cutSize, fitCut, movedCut, shownSize } from '../../picture-cut';
import { SheetComponent } from '../sheet/sheet.component';

const PICTURE_TYPE = 'image/jpeg';
const PICTURE_QUALITY = 0.9;
const PERCENT = 100;

@Component({
    selector: 'app-picture-cut',
    standalone: true,
    imports: [TranslatePipe, SheetComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './picture-cut.component.html',
    styleUrl: './picture-cut.component.scss'
})
export class PictureCutComponent {
    public readonly picture = input.required<Blob>();
    public readonly finished = output<Blob>();
    public readonly cancelled = output<void>();

    protected readonly mostZoom = MOST_ZOOM;
    protected readonly failed = signal(false);
    protected readonly size = signal<Size | undefined>(undefined);
    protected readonly chosen = signal<Cut>(WHOLE);
    protected readonly address = signal<string | undefined>(undefined);

    protected readonly place = computed(() => {
        const size = this.size();
        if (!size) {
            return undefined;
        }
        const { x, y, zoom } = this.chosen();
        const shown = shownSize(size, zoom);

        return {
            width: shown.width * PERCENT,
            height: shown.height * PERCENT,
            left: (0.5 - x * shown.width) * PERCENT,
            top: (0.5 - y * shown.height) * PERCENT
        };
    });

    private readonly image = viewChild<ElementRef<HTMLImageElement>>('image');
    private readonly touches = new Map<number, { x: number; y: number }>();

    constructor() {
        effect((onCleanup) => {
            const address = URL.createObjectURL(this.picture());
            this.address.set(address);
            onCleanup(() => URL.revokeObjectURL(address));
        });
    }

    protected loaded(image: HTMLImageElement): void {
        this.size.set({ width: image.naturalWidth, height: image.naturalHeight });
        this.chosen.set(WHOLE);
    }

    protected zoomTo(zoom: number): void {
        const size = this.size();
        if (size) {
            this.chosen.update((chosen) => fitCut(size, { ...chosen, zoom }));
        }
    }

    protected pressed(event: PointerEvent): void {
        (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
        this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    protected moved(event: PointerEvent): void {
        const size = this.size();
        const before = this.touches.get(event.pointerId);
        if (!size || !before) {
            return;
        }
        const frame = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const spread = this.spread();
        this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (this.touches.size > 1) {
            this.zoomTo((this.chosen().zoom * this.spread()) / (spread || 1));
        } else if (frame.width && frame.height) {
            this.chosen.update((chosen) =>
                movedCut(
                    size,
                    chosen,
                    (event.clientX - before.x) / frame.width,
                    (event.clientY - before.y) / frame.height
                )
            );
        }
    }

    protected released(event: PointerEvent): void {
        this.touches.delete(event.pointerId);
    }

    protected confirm(): void {
        const size = this.size();
        const image = this.image()?.nativeElement;
        if (!size || !image) {
            return;
        }
        const region = cutRegion(size, this.chosen());
        const canvas = document.createElement('canvas');
        Object.assign(canvas, cutSize(region));
        canvas
            .getContext('2d')
            ?.drawImage(image, region.x, region.y, region.width, region.height, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
            (blob) => (blob ? this.finished.emit(blob) : this.failed.set(true)),
            PICTURE_TYPE,
            PICTURE_QUALITY
        );
    }

    private spread(): number {
        const [first, second] = [...this.touches.values()];

        return second ? Math.hypot(first.x - second.x, first.y - second.y) : 0;
    }
}
