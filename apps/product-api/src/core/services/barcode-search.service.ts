import { Injectable } from '@nestjs/common';

import { BarcodeCandidate } from '@barcodescanner/shared';

import { CatalogItemEntity } from '../../data/entities';
import { BarcodeHit } from '../connectors/connector.model';
import { isShopCode, orderHits, searchWords, variantFor } from '../rules/barcode-search';
import { BarcodeService } from './barcode.service';
import { CatalogService } from './catalog.service';
import { ConnectorService } from './connector.service';

@Injectable()
export class BarcodeSearchService {
    constructor(
        private readonly connectors: ConnectorService,
        private readonly barcodes: BarcodeService,
        private readonly catalog: CatalogService
    ) {}

    public async search(query: string, catalogItemId?: number): Promise<Array<BarcodeCandidate>> {
        const product = catalogItemId ? await this.catalog.getItem(catalogItemId) : undefined;
        const words = searchWords(query);
        const hits = words ? orderHits(await this.connectors.searchAll(words)) : [];
        const known = await this.barcodes.getMany(hits.map(({ code }) => code));

        return Promise.all(
            hits.map((hit) =>
                this.candidate(hit, known.find(({ code }) => code === hit.code)?.catalogItem ?? undefined, product)
            )
        );
    }

    private async candidate(
        hit: BarcodeHit,
        owner?: CatalogItemEntity,
        product?: CatalogItemEntity
    ): Promise<BarcodeCandidate> {
        const shopCode = isShopCode(hit.code);
        const others = shopCode
            ? []
            : (await this.connectors.lookupAll(hit.code, hit.suggestion.connectorId)).suggestions;
        const suggestions = [...others, hit.suggestion];

        return {
            code: hit.code,
            suggestions,
            size: hit.size,
            note: product ? variantFor(suggestions, product) : '',
            shopCode,
            catalogItem: owner && { id: owner.id, name: owner.name }
        };
    }
}
