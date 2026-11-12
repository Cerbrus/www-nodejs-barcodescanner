import { ProductDto } from './product.dto';

export class BarcodeDto {
    barcode!: string;
    scanCount!: number;
    product!: ProductDto;
}
