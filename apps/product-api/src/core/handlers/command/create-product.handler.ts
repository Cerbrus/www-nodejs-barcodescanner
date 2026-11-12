import { CommandHandler, IInferredCommandHandler } from '@nestjs-architects/typed-cqrs';
import { CreateProductCommand } from '../../commands';
import { BarcodeRepository, ProductRepository, StoreProductRepository } from '../../../data/repositories';
import { ProductEntity } from '../../../data/entities';
import { MissingEntityException } from '../../exceptions';
import { In } from 'typeorm';

@CommandHandler(CreateProductCommand)
export class CreateProductHandler implements IInferredCommandHandler<CreateProductCommand> {
    constructor(
        private readonly productRepository: ProductRepository,
        private readonly storeProductRepository: StoreProductRepository,
        private readonly barcodeRepository: BarcodeRepository
    ) {
    }

    async execute(command: CreateProductCommand): Promise<ProductEntity> {
        const { name, barcodes, storeProductIds } = command;

        // Load the barcode entities to which the product will be linked
        const barcodeEntities = await this.barcodeRepository.find({ where: { barcode: In([...barcodes]) } });
        if (barcodeEntities.length != barcodes.length) {
            throw new MissingEntityException('Barcode', barcodes.join(', ')); // Replace with proper exception
        }

        // Load the store product entities to which the product will be linked
        const storeProductEntities = await this.storeProductRepository.find({ where: { id: In([...storeProductIds]) } });
        if (storeProductEntities.length != storeProductIds.length) {
            throw new MissingEntityException('StoreProduct', storeProductIds.join(', ')); // Replace with proper exception
        }

        const productEntity = this.productRepository.create({
            genericName: name ?? 'New Product',
            barcodes: barcodeEntities,
            storeProducts: storeProductEntities
        });

        return await this.productRepository.save(productEntity);
    }
}
