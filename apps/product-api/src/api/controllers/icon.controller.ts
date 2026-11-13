import { Controller, Get } from '@nestjs/common';

import { CatalogService } from '../../core/services/catalog.service';

@Controller({ path: 'icons', version: '1' })
export class IconController {
    constructor(private readonly catalog: CatalogService) {
    }

    @Get()
    public getIconNames(): Promise<Array<string>> {
        return this.catalog.getIconNames();
    }
}
