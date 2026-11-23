import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    ValidateNested
} from 'class-validator';

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

    @IsOptional()
    @IsString()
    @Matches(/^R\d;[\x20-\x7e]{0,2000}$/)
    public code?: string;

    @IsOptional()
    @IsBoolean()
    public save?: boolean;
}
