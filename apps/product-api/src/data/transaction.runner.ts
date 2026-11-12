import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class TransactionRunner {
    constructor(private readonly datasource: DataSource) {}

    public run(trnsFn: (manager: EntityManager) => Promise<void>): Promise<void> {
        return this.datasource.transaction(trnsFn);
    }
}
