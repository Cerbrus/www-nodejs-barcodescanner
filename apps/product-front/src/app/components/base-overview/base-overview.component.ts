import { ITableColumn } from '../paginated-table/paginated-table.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, EventType, Router } from '@angular/router';
import { DestroyRef, Directive, OnInit } from '@angular/core';
import { firstValueFrom, Observable, tap } from 'rxjs';

@Directive()
export abstract class BaseOverviewComponent<TEntity, TTableRow extends { id: string }> implements OnInit {
    protected rows: Array<TTableRow> = [];

    protected abstract columns: Array<ITableColumn<TTableRow>>;
    protected detailEntityId: string | null = null;

    protected constructor(
        private readonly componentName: string,
        private readonly entityRoute: string,
        private readonly route: ActivatedRoute,
        private readonly router: Router,
        protected readonly destroyRef: DestroyRef
    ) {

        router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
            if (e.type === EventType.NavigationEnd) this.requestData();
        });
    }

    public ngOnInit(): void {
        this.route.firstChild?.params
            .pipe(
                tap((params) => (this.detailEntityId = params['id'] !== 'overview' ? params['id'] : null)),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe();
    }

    protected abstract fetchData(): Observable<Array<TEntity>> ;

    protected abstract mapEntityToTableRow(entity: TEntity): TTableRow;

    protected async requestData(): Promise<void> {
        // Fetch products
        const result = await firstValueFrom(this.fetchData());

        // Extract response data
        this.rows = await Promise.all(result.map((e: TEntity) => this.mapEntityToTableRow(e)));
    }

    protected openDetails({ data }: { data: TTableRow; event: MouseEvent }): void {
        this.detailEntityId = data.id;
        this.router.navigate([this.entityRoute, data.id]);
    }


    protected buildColumn(key: keyof TTableRow, enabled = true): ITableColumn<TTableRow> {
        return { key, label: `${this.componentName}.columns.${key.toString()}`, enabled, type: 'text' };
    }
}
