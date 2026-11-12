import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from './';
import { Repository } from 'typeorm';
import { ProductEntity } from '../entities';

@Injectable()
export class ProductRepository extends BaseRepository<ProductEntity> {
    constructor(@InjectRepository(ProductEntity) repository: Repository<ProductEntity>) {
        super(repository);
    }
}
