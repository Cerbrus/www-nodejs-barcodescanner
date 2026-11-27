import { RecipeCategory } from '@barcodescanner/shared';

import { IconName } from './icon-names';

export const RECIPE_CATEGORY_ICONS: Record<RecipeCategory, IconName> = {
    breakfast: 'egg_alt',
    lunch: 'lunch_dining',
    dinner: 'dinner_dining',
    soup: 'soup_kitchen',
    salad: 'nutrition',
    dessert: 'icecream',
    baking: 'cake',
    snack: 'cookie',
    other: 'restaurant'
};
