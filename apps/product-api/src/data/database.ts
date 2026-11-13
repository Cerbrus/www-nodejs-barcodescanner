import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import Database from 'better-sqlite3';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { Entities } from './entities';
import { InitialSchema1762900000000 } from './migrations/1762900000000-initial-schema';
import { PushSubscription1762990000000 } from './migrations/1762990000000-push-subscription';
import { PushOrigin1763000000000 } from './migrations/1763000000000-push-origin';
import { FeedbackSetting1763010000000 } from './migrations/1763010000000-feedback-setting';
import { BarcodeLookupFailed1763020000000 } from './migrations/1763020000000-barcode-lookup-failed';

export function databaseOptions(databasePath: string): TypeOrmModuleOptions {
    return {
        type: 'better-sqlite3',
        driver: Database,
        database: databasePath,
        entities: Entities,
        migrations: [
            InitialSchema1762900000000,
            PushSubscription1762990000000,
            PushOrigin1763000000000,
            FeedbackSetting1763010000000,
            BarcodeLookupFailed1763020000000
        ],
        migrationsRun: true,
        synchronize: false,
        namingStrategy: new SnakeNamingStrategy()
    };
}
