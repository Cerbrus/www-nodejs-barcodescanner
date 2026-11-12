import { Component, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, EventType, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ITableColumn } from '../../components/paginated-table/paginated-table.component';
import { SelectBoxOption } from '../../components/select-box/select-box.component';
import { BaseOverviewComponent } from '../../components/base-overview/base-overview.component';
import { BarcodeTableRow } from './barcode-table-row.model';
import { BarcodeService } from '../../services/barcode.service';
import { BarcodeDto } from '../../services/api/dto';
import { BarcodeComponent } from '../../components/barcode';

@Component({
    selector: 'app-barcode-overview',
    standalone: true,
    imports: [TranslateModule, FormsModule, BarcodeComponent],
    templateUrl: './barcode-overview.component.html',
    styleUrl: './barcode-overview.component.scss'
})
export class BarcodeOverviewComponent
    extends BaseOverviewComponent<BarcodeDto, BarcodeTableRow>
    implements OnInit {

    protected columns: Array<ITableColumn<BarcodeTableRow>> = [
        this.buildColumn('barcode', true),
        this.buildColumn('productName', true),
        this.buildColumn('scanCount', true)
    ];

    protected openClosedOptions: Array<SelectBoxOption<boolean>>;
    protected showOpenClosed: SelectBoxOption<boolean>;

    protected width = 300;
    protected height = 200;
    protected lockRatio = true;

    constructor(
        private readonly barcodeService: BarcodeService,
        translate: TranslateService,
        route: ActivatedRoute,
        router: Router,
        destroyRef: DestroyRef
    ) {
        super('BarcodeOverviewComponent', 'barcode', route, router, destroyRef);

        this.openClosedOptions = [
            { id: 'open', label: translate.get('PollOverviewComponent.show.open'), item: true },
            { id: 'closed', label: translate.get('PollOverviewComponent.show.closed'), item: false }
        ];
        this.showOpenClosed = this.openClosedOptions[0];

        router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
            if (e.type === EventType.NavigationEnd) this.requestData();
        });
    }

    public override ngOnInit(): void {
        super.ngOnInit();
        this.fetchData().subscribe();
    }

    protected override mapEntityToTableRow(entity: BarcodeDto): BarcodeTableRow {
        return {
            id: entity.barcode,
            barcode: entity.barcode,
            scanCount: entity.scanCount,
            productName: entity.product?.genericName
        };
    }

    protected override fetchData() {
        return this.barcodeService.getBarcodes();
    }
}
