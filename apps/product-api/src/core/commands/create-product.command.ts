import { Command } from '@nestjs-architects/typed-cqrs';
import { ProductEntity } from '../../data/entities';

export class CreateProductCommand extends Command<ProductEntity> {
    constructor(public readonly name: string,
                public readonly barcodes?: Array<string>,
                public readonly storeProductIds?: Array<string>) {
        super();
    }
}
