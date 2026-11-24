import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    afterNextRender,
    computed,
    inject,
    signal,
    viewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { catchError, of, switchMap, tap } from 'rxjs';

import { RecipeContent, isRecipeCode, readRecipeCode } from '@barcodescanner/shared';

import { NamingOutcome, NamingPromptComponent } from '../../components/naming-prompt/naming-prompt.component';
import { RecipeChoice, RecipeSheetComponent } from '../../components/recipe-sheet/recipe-sheet.component';
import { withNote } from '../../display-name';
import { ScanOutcome } from '../../models';
import { ApiService } from '../../services/api.service';
import { ShoppingStore } from '../../services/shopping.store';
import { ToastService } from '../../services/toast.service';

const SAME_CODE_PAUSE_MILLISECONDS = 3000;
const SCAN_INTERVAL_MILLISECONDS = 150;
const CODE_PATTERN = /^\d{8,14}$/;
const ATTENTION_RESULTS: Array<ScanOutcome['result']> = ['needs_name', 'not_on_list'];
const FORMATS = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.QR_CODE];

type CameraState = 'starting' | 'running' | 'blocked' | 'unsupported';

interface ScannedRecipe {
    code: string;
    recipe: RecipeContent;
}

@Component({
    selector: 'app-scan-page',
    standalone: true,
    imports: [FormsModule, TranslatePipe, NamingPromptComponent, RecipeSheetComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './scan.page.html',
    styleUrl: './scan.page.scss'
})
export class ScanPage {
    protected readonly state = signal<CameraState>('starting');
    protected readonly namingCode = signal<string | undefined>(undefined);
    protected readonly scanned = signal<ScannedRecipe | undefined>(undefined);
    protected readonly lastOutcome = signal<ScanOutcome | undefined>(undefined);
    protected readonly manualCode = signal('');

    private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
    private readonly api = inject(ApiService);
    private readonly store = inject(ShoppingStore);
    private readonly toasts = inject(ToastService);
    private readonly translate = inject(TranslateService);

    protected readonly collecting = this.store.collecting;
    protected readonly savable = computed(() => {
        const name = this.scanned()?.recipe.name.trim();

        return !this.store.recipes().some((recipe) => recipe.name === name);
    });

    private controls?: IScannerControls;
    private lastCode = '';
    private lastCodeAt = 0;

    constructor() {
        afterNextRender(() => this.startCamera());
        inject(DestroyRef).onDestroy(() => this.controls?.stop());
    }

    protected submitManual(): void {
        const code = this.manualCode().trim();
        if (CODE_PATTERN.test(code)) {
            this.manualCode.set('');
            this.register(code);
        }
    }

    protected onNamed(outcome: NamingOutcome): void {
        this.namingCode.set(undefined);
        this.startCamera();

        if (outcome.kind === 'linked') {
            this.toasts.show({ kind: 'ok', text: this.translate.instant('scan.linked', { name: outcome.item.name }) });
        } else if (outcome.kind === 'discarded') {
            this.toasts.show({ kind: 'attention', text: this.translate.instant('scan.discarded') });
        }
    }

    protected addRecipe({ ingredients, save }: RecipeChoice): void {
        const scanned = this.scanned();
        if (!scanned) {
            return;
        }

        this.closeRecipe();
        this.store
            .putRecipeOnList({ name: scanned.recipe.name, ingredients }, { code: scanned.code, save })
            .pipe(
                catchError(() => {
                    this.toasts.show({ kind: 'error', text: this.translate.instant('scan.failed') });
                    return of(undefined);
                })
            )
            .subscribe();
    }

    protected closeRecipe(): void {
        this.scanned.set(undefined);
        this.lastCodeAt = Date.now();
        this.startCamera();
    }

    private async startCamera(): Promise<void> {
        if (!navigator.mediaDevices?.getUserMedia) {
            this.state.set('unsupported');
            return;
        }

        const hints = new Map<DecodeHintType, unknown>([[DecodeHintType.POSSIBLE_FORMATS, FORMATS]]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: SCAN_INTERVAL_MILLISECONDS });

        this.state.set('starting');

        try {
            this.controls = await reader.decodeFromConstraints(
                {
                    audio: false,
                    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
                },
                this.video().nativeElement,
                (result) => {
                    if (result) {
                        this.onDecoded(result.getText());
                    }
                }
            );
            this.state.set('running');
        } catch {
            this.state.set('blocked');
        }
    }

    private stopCamera(): void {
        this.controls?.stop();
        this.controls = undefined;
    }

    private onDecoded(code: string): void {
        const now = Date.now();
        const repeated = code === this.lastCode && now - this.lastCodeAt < SAME_CODE_PAUSE_MILLISECONDS;
        const recipe = isRecipeCode(code);
        if (repeated || this.namingCode() || this.scanned() || !(recipe || CODE_PATTERN.test(code))) {
            return;
        }

        this.lastCode = code;
        this.lastCodeAt = now;
        if (recipe) {
            this.openRecipe(code);
        } else {
            this.register(code);
        }
    }

    private openRecipe(code: string): void {
        const recipe = readRecipeCode(code);
        if (!recipe?.name.trim()) {
            this.toasts.show({ kind: 'attention', text: this.translate.instant('scan.recipeUnreadable') });
            return;
        }

        navigator.vibrate?.(60);
        this.stopCamera();
        this.scanned.set({ code, recipe });
    }

    private register(code: string): void {
        this.api
            .scan(code, this.collecting())
            .pipe(
                tap((outcome) => this.showOutcome(outcome)),
                switchMap(() => this.store.refreshListAndInbox()),
                catchError(() => {
                    this.toasts.show({ kind: 'error', text: this.translate.instant('scan.failed') });
                    return of(undefined);
                })
            )
            .subscribe();
    }

    private showOutcome(outcome: ScanOutcome): void {
        this.lastOutcome.set(outcome);
        navigator.vibrate?.(ATTENTION_RESULTS.includes(outcome.result) ? [60, 60, 60] : 60);

        if (outcome.result === 'needs_name') {
            this.stopCamera();
            this.namingCode.set(outcome.code);
            return;
        }
        if (outcome.result === 'ignored') {
            return;
        }

        const text = this.translate.instant(`scan.${outcome.result}`, {
            name: withNote(outcome.itemName, outcome.note),
            quantity: outcome.quantity
        });
        if (outcome.result === 'not_on_list') {
            this.toasts.show({ kind: 'attention', text });
            return;
        }

        this.toasts.show({
            kind: 'ok',
            text,
            actionLabel: this.translate.instant('history.undo'),
            actionIcon: 'undo',
            action: () => this.undo()
        });
    }

    private undo(): void {
        this.api
            .undoScan()
            .pipe(switchMap(() => this.store.refreshListAndInbox()))
            .subscribe();
    }
}
