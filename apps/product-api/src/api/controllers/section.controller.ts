import { Controller, Get } from '@nestjs/common';

import { CatalogService } from '../../core/services/catalog.service';
import { SectionEntity } from '../../data/entities';

@Controller({ path: 'sections', version: '1' })
export class SectionController {
    constructor(private readonly catalog: CatalogService) {
    }

    @Get()
    public getSections(): Promise<Array<SectionEntity>> {
        return this.catalog.getSections();
    }
}
