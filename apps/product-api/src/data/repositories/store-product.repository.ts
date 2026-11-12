import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from './';
import { Repository } from 'typeorm';
import { StoreProductEntity } from '../entities';

@Injectable()
export class StoreProductRepository extends BaseRepository<StoreProductEntity> {
    constructor(@InjectRepository(StoreProductEntity) repository: Repository<StoreProductEntity>) {
        super(repository);
    }
}
