import { IInferredQueryHandler, QueryHandler } from '@nestjs-architects/typed-cqrs';
import { ProductRepository } from '../../../data/repositories';
import { ListProductsQuery } from '../../queries';
import { ProductEntity } from '../../../data/entities';
import { Like } from 'typeorm';

@QueryHandler(ListProductsQuery)
export class ListProductHandler implements IInferredQueryHandler<ListProductsQuery> {
    constructor(private readonly productRepository: ProductRepository) {
    }

    async execute(query: ListProductsQuery): Promise<Array<ProductEntity>> {
        const { name } = query;

        return this.productRepository.find({
            where: {
                genericName: Like(`%${name ?? ''}%`)
            }
        });
    }
}
