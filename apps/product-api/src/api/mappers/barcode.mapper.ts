import { BaseMapper, ProductMapper } from './';
import { BarcodeEntity } from '../../data/entities';
import { BarcodeDto } from '../dto';

export class BarcodeMapper extends BaseMapper<BarcodeEntity, BarcodeDto>(
    (source: BarcodeEntity): BarcodeDto => ({
        barcode: source.barcode,
        scanCount: source.scanCount,
        product: ProductMapper.map(source.product)
    })
) {
}
