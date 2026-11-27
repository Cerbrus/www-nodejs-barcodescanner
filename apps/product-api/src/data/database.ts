import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import Database from 'better-sqlite3';

import { Entities } from './entities';
import { InitialSchema1762900000000 } from './migrations/1762900000000-initial-schema';
import { PushSubscription1762990000000 } from './migrations/1762990000000-push-subscription';
import { PushOrigin1763000000000 } from './migrations/1763000000000-push-origin';
import { FeedbackSetting1763010000000 } from './migrations/1763010000000-feedback-setting';
import { BarcodeLookupFailed1763020000000 } from './migrations/1763020000000-barcode-lookup-failed';
import { Remark1763200000000 } from './migrations/1763200000000-remark';
import { MissingEmojis1763300000000 } from './migrations/1763300000000-missing-emojis';
import { ListVariants1763400000000 } from './migrations/1763400000000-list-variants';
import { SoundPresets1763500000000 } from './migrations/1763500000000-sound-presets';
import { Recipes1763600000000 } from './migrations/1763600000000-recipes';
import { CollectingScans1763700000000 } from './migrations/1763700000000-collecting-scans';
import { RecipeOffers1763800000000 } from './migrations/1763800000000-recipe-offers';
import { DraftProducts1763900000000 } from './migrations/1763900000000-draft-products';
import { IngredientText1764000000000 } from './migrations/1764000000000-ingredient-text';
import { RecipeCategory1764100000000 } from './migrations/1764100000000-recipe-category';
import { RecipeSourceUrl1764200000000 } from './migrations/1764200000000-recipe-source-url';
import { RecipePicture1764300000000 } from './migrations/1764300000000-recipe-picture';
import { SnakeNamingStrategy } from './snake-naming.strategy';

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
            BarcodeLookupFailed1763020000000,
            Remark1763200000000,
            MissingEmojis1763300000000,
            ListVariants1763400000000,
            SoundPresets1763500000000,
            Recipes1763600000000,
            CollectingScans1763700000000,
            RecipeOffers1763800000000,
            DraftProducts1763900000000,
            IngredientText1764000000000,
            RecipeCategory1764100000000,
            RecipeSourceUrl1764200000000,
            RecipePicture1764300000000
        ],
        migrationsRun: true,
        synchronize: false,
        namingStrategy: new SnakeNamingStrategy()
    };
}
