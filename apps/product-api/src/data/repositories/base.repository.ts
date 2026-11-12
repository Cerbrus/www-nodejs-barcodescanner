import { Injectable } from '@nestjs/common';
import { EntityManager, ObjectLiteral, Repository } from 'typeorm';

@Injectable()
export class BaseRepository<Entity extends ObjectLiteral> extends Repository<Entity> {
    constructor(repository: Repository<Entity>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }

    public transaction(trnsFn: (manager: EntityManager) => Promise<void>): Promise<void> {
        return this.manager.transaction(trnsFn);
    }
}
