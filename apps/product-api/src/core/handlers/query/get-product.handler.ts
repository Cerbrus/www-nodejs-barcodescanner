import { IInferredQueryHandler, QueryHandler } from '@nestjs-architects/typed-cqrs';
import { GetProductQuery } from '../../queries';
import { ProductRepository } from '../../../data/repositories';
import { ProductEntity } from '../../../data/entities';
import { MissingEntityException } from '../../exceptions';

@QueryHandler(GetProductQuery)
export class GetProductHandler implements IInferredQueryHandler<GetProductQuery> {
    constructor(private readonly productRepository: ProductRepository) {
    }

    async execute(query: GetProductQuery): Promise<ProductEntity> {
        const { productId } = query;

        return await this.productRepository
            .findOne({ where: { id: productId } })
            .then(MissingEntityException.returnOrThrow('Product', productId));
    }
}
