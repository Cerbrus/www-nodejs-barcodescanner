import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

import { MAX_RECIPE_INGREDIENTS, MAX_RECIPE_NAME_LENGTH } from '@barcodescanner/shared';

import { RecipeIngredientDto } from './recipe-ingredient.dto';

export class RecipeAdditionDto {
    @IsString()
    @Matches(/\S/)
    @MaxLength(MAX_RECIPE_NAME_LENGTH)
    public name: string;

    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(MAX_RECIPE_INGREDIENTS)
    @ValidateNested({ each: true })
    @Type(() => RecipeIngredientDto)
    public ingredients: Array<RecipeIngredientDto>;
}
