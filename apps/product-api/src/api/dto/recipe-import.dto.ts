import { IsString, Matches, MaxLength } from 'class-validator';

import { MAX_RECIPE_SOURCE_LENGTH } from '@barcodescanner/shared';

export class RecipeImportDto {
    @IsString()
    @Matches(/\S/)
    @MaxLength(MAX_RECIPE_SOURCE_LENGTH)
    public source: string;
}
