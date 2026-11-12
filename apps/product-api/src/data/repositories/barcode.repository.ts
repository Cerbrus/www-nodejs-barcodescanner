import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from './';
import { Repository } from 'typeorm';
import { BarcodeEntity } from '../entities';

@Injectable()
export class BarcodeRepository extends BaseRepository<BarcodeEntity> {
    constructor(@InjectRepository(BarcodeEntity) repository: Repository<BarcodeEntity>) {
        super(repository);
    }
}
