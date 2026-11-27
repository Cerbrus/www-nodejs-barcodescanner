import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import {
    MAX_INGREDIENT_NOTE_LENGTH,
    MAX_INGREDIENT_QUANTITY,
    MAX_INGREDIENT_TEXT_LENGTH
} from '@barcodescanner/shared';

export class RecipeIngredientDto {
    @IsInt()
    @Min(1)
    public catalogItemId: number;

    @IsInt()
    @Min(1)
    @Max(MAX_INGREDIENT_QUANTITY)
    public quantity: number;

    @IsString()
    @MaxLength(MAX_INGREDIENT_NOTE_LENGTH)
    public note: string;

    @IsOptional()
    @IsString()
    @MaxLength(MAX_INGREDIENT_TEXT_LENGTH)
    public text?: string;
}
