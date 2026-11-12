import { ProductDto } from './';

export class BarcodeDto {
    barcode: string;
    scanCount: number;
    product: ProductDto;
}
