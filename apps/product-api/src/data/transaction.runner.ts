import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class TransactionRunner {
    private queue: Promise<unknown> = Promise.resolve();

    constructor(private readonly dataSource: DataSource) {
    }

    public run<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
        const result = this.queue.then(() => this.dataSource.transaction(work));
        this.queue = result.catch(() => undefined);

        return result;
    }
}
