import { BarcodeDto } from './';
import { StoreProductDto } from '.';

export class ProductDto {
    id: string;
    genericName: string;
    barcodes: Array<BarcodeDto>;
    storeProducts: Array<StoreProductDto>;
}
