import { IsString, MaxLength } from 'class-validator';

import { MAX_RECIPE_SOURCE_URL_LENGTH } from '@barcodescanner/shared';

export class RecipePictureLinkDto {
    @IsString()
    @MaxLength(MAX_RECIPE_SOURCE_URL_LENGTH)
    public source: string;
}
