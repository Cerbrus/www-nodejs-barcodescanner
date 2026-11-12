import { CommandBus, QueryBus } from '@nestjs-architects/typed-cqrs';
import { Injectable } from '@nestjs/common';
import { ProductEntity } from '../../data/entities';
import { GetProductQuery, ListProductsQuery } from '../queries';
import { CreateProductCommand } from '../commands';

@Injectable()
export class ProductService {
    constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {
    }

    getProduct(id: string): Promise<ProductEntity> {
        const pollQuery = new GetProductQuery(id);
        return this.queryBus.execute(pollQuery);
    }

    createProduct(name: string, data: string, barcodes: Array<string>, productIds: Array<string>): Promise<ProductEntity> {
        const createProductCommand = new CreateProductCommand(name, barcodes, productIds);
        return this.commandBus.execute(createProductCommand);
    }

    getProducts(options?: { name?: string }): Promise<Array<ProductEntity>> {
        const { name } = options ?? {};
        const pollQuery = new ListProductsQuery(name);
        return this.queryBus.execute(pollQuery);
    }
}
