import { Query } from '@nestjs-architects/typed-cqrs';
import { ProductEntity } from '../../data/entities';

export class GetProductQuery extends Query<ProductEntity> {
    constructor(public readonly productId: string) {
        super();
    }
}
