import { ProductDto } from './product.dto';

export enum StoreTypeDto {
    AH = 'AH',
    Lidl = 'Lidl',
    Jumbo = 'Jumbo',
    Dirk = 'Dirk',
    Aldi = 'Aldi',
}

export class StoreProductDto {
    id!: string;
    product!: ProductDto;
    type!: StoreTypeDto;
    data!: string;
}
