import { BarcodeEntity } from './barcode.entity';
import { CatalogItemEntity } from './catalog-item.entity';
import { FeedbackSettingEntity } from './feedback-setting.entity';
import { ListEntryEntity } from './list-entry.entity';
import { PushSubscriptionEntity } from './push-subscription.entity';
import { RecipeIngredientEntity } from './recipe-ingredient.entity';
import { RecipeEntity } from './recipe.entity';
import { RemarkEntity } from './remark.entity';
import { ScanChangeEntity } from './scan-change.entity';
import { ScanEntity } from './scan.entity';
import { SectionEntity } from './section.entity';
import { SettingEntity } from './setting.entity';
import { SoundEntity } from './sound.entity';

export * from './section.entity';
export * from './catalog-item.entity';
export * from './barcode.entity';
export * from './list-entry.entity';
export * from './scan.entity';
export * from './scan-change.entity';
export * from './push-subscription.entity';
export * from './feedback-setting.entity';
export * from './remark.entity';
export * from './setting.entity';
export * from './sound.entity';
export * from './recipe.entity';
export * from './recipe-ingredient.entity';

export const Entities = [
    SectionEntity,
    CatalogItemEntity,
    BarcodeEntity,
    ListEntryEntity,
    ScanEntity,
    ScanChangeEntity,
    PushSubscriptionEntity,
    FeedbackSettingEntity,
    RemarkEntity,
    SettingEntity,
    SoundEntity,
    RecipeEntity,
    RecipeIngredientEntity
];
