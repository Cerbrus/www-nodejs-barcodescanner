import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

import { MAX_RECIPE_DESCRIPTION_LENGTH, MAX_RECIPE_INGREDIENTS, MAX_RECIPE_NAME_LENGTH } from '@barcodescanner/shared';

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

    @IsArray()
    @ArrayMaxSize(MAX_RECIPE_INGREDIENTS)
    @ValidateNested({ each: true })
    @Type(() => RecipeIngredientDto)
    public ingredients: Array<RecipeIngredientDto>;
}
