import { BaseMapper, ProductMapper } from './';
import { StoreProductEntity } from '../../data/entities';
import { StoreProductDto, StoreTypeDto } from '../dto';

export class StoreProductMapper extends BaseMapper<StoreProductEntity, StoreProductDto>(
    (source: StoreProductEntity): StoreProductDto => ({
        id: source.id,
        type: source.type as unknown as StoreTypeDto,
        data: source.data,
        product: ProductMapper.map(source.product)
    })
) {
}
