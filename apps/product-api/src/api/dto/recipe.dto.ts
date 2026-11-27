import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

import {
    MAX_RECIPE_DESCRIPTION_LENGTH,
    MAX_RECIPE_INGREDIENTS,
    MAX_RECIPE_NAME_LENGTH,
    MAX_RECIPE_SOURCE_URL_LENGTH,
    RECIPE_CATEGORIES,
    RECIPE_SOURCE_URL,
    RecipeCategory
} from '@barcodescanner/shared';

import { RecipeIngredientDto } from './recipe-ingredient.dto';

export class RecipeDto {
    @IsString()
    @Matches(/\S/)
    @MaxLength(MAX_RECIPE_NAME_LENGTH)
    public name: string;

    @IsOptional()
    @IsString()
    @MaxLength(MAX_RECIPE_DESCRIPTION_LENGTH)
    public description?: string;

    @IsOptional()
    @IsIn(RECIPE_CATEGORIES)
    public category?: RecipeCategory;

    @IsOptional()
    @IsString()
    @MaxLength(MAX_RECIPE_SOURCE_URL_LENGTH)
    @Matches(RECIPE_SOURCE_URL)
    public sourceUrl?: string;

    @IsArray()
    @ArrayMaxSize(MAX_RECIPE_INGREDIENTS)
    @ValidateNested({ each: true })
    @Type(() => RecipeIngredientDto)
    public ingredients: Array<RecipeIngredientDto>;
}
