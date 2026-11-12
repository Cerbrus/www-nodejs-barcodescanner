import { BarcodeMapper, BaseMapper, StoreProductMapper } from './';
import { ProductEntity } from '../../data/entities';
import { ProductDto } from '../dto';

export class ProductMapper extends BaseMapper<ProductEntity, ProductDto>(
    (source: ProductEntity): ProductDto => ({
        id: source.id,
        genericName: source.genericName,
        barcodes: source.barcodes?.map(BarcodeMapper.map) || [],
        storeProducts: source.storeProducts?.map(StoreProductMapper.map) || []
    })
) {
}
