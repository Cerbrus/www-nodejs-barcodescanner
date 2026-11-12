import { Controller, Get } from '@nestjs/common';
import { AHConnector, JumboConnector } from '../../core/services/connectors';
import { firstValueFrom } from 'rxjs';
// import { BarcodeDto, BarcodeFilterDto } from '../dto';

// import { BarcodeService } from '../../core/services/barcode.service';

@Controller({ path: 'barcode', version: '1' })
export class BarcodeController {
    constructor(
        // private readonly barcodeService: BarcodeService,
        private readonly ahConnector: AHConnector,
        private readonly jumboConnector: JumboConnector
    ) {
    }

    @Get('test-connectors')
    async testConnectors(): Promise<any> {
        // Example usage of AHConnector
        const ahProduct = await firstValueFrom(this.ahConnector.getProductByBarcode('8710400725244')); // AH Magere Yoghurt, 1.5L
        const ahProductDetails = await firstValueFrom(this.ahConnector.getProductDetails(ahProduct));

        // Example usage of JumboConnector
        // const jumboProduct = await firstValueFrom(this.jumboConnector.getProductByBarcode('8718452645275')); // Halfvolle Melk, 2L
        // console.log('Jumbo Product:', jumboProduct);
        // const jumboResult = await firstValueFrom(this.jumboConnector.getAllStores()); // Halfvolle Melk, 2L
        // console.log('Jumbo Result:', jumboResult);

        return { ahProduct, ahProductDetails };
    }

    // @Get()
    // listBarcodes(@Query() filters: BarcodeFilterDto): Promise<Array<BarcodeDto>> {
    //     const { name } = filters;
    //     return this.barcodeService
    //         .getBarcodes({ name })
    //         .then((barcodes) => barcodes.map(BarcodeMapper.map));
    // }
    //
    // @Get(':id')
    // getBarcode(@Param('id', ParseUUIDPipe) id: string): Promise<BarcodeDto | undefined> {
    //     return this.barcodeService.getBarcode(id).then(BarcodeMapper.map);
    // }
}

@Controller({ path: 'test', version: '1' })
export class TestController {
    @Get()
    ping(): string {
        return 'pong';
    }
}
