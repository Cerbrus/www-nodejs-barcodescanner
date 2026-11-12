import { Query } from '@nestjs-architects/typed-cqrs';
import { ProductEntity } from '../../data/entities';

export class ListProductsQuery extends Query<Array<ProductEntity>> {
    constructor(
        public readonly name?: string
    ) {
        super();
    }
}
