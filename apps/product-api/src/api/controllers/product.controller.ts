import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ProductDto, ProductFilterDto } from '../dto';
import { ProductMapper } from '../mappers';
import { ProductService } from '../../core/services/product.service';

@Controller({ path: 'product', version: '1' })
export class ProductController {
    constructor(private readonly productService: ProductService) {
    }

    @Get()
    listProducts(@Query() filters: ProductFilterDto): Promise<Array<ProductDto>> {
        const { name } = filters;
        return this.productService
            .getProducts({ name })
            .then((products) => products.map(ProductMapper.map));
    }

    @Get(':id')
    getProduct(@Param('id', ParseUUIDPipe) id: string): Promise<ProductDto | undefined> {
        return this.productService.getProduct(id).then(ProductMapper.map);
    }
}
