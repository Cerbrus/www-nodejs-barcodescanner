import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import Database from 'better-sqlite3';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { Entities } from './entities';
import { InitialSchema1762900000000 } from './migrations/1762900000000-initial-schema';

export function databaseOptions(databasePath: string): TypeOrmModuleOptions {
    return {
        type: 'better-sqlite3',
        driver: Database,
        database: databasePath,
        entities: Entities,
        migrations: [InitialSchema1762900000000],
        migrationsRun: true,
        synchronize: false,
        namingStrategy: new SnakeNamingStrategy()
    };
}
