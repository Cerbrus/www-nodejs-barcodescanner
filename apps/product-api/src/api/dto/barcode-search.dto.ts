import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { BARCODE_SEARCH_MAX } from '@barcodescanner/shared';

export class BarcodeSearchDto {
    @IsString()
    @Matches(/\S/)
    @MaxLength(BARCODE_SEARCH_MAX)
    public query: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    public catalogItemId?: number;
}
