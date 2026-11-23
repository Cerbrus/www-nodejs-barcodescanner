import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsISO8601,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    Min,
    ValidateIf,
    ValidateNested
} from 'class-validator';

import { ListState } from '@barcodescanner/shared';

const MAX_CHANGES = 200;

export const ENTRY_ID = /^[0-9a-f-]{8,64}$/i;

export class OfflineChangeDto {
    @IsOptional()
    @Matches(ENTRY_ID)
    public id?: string;

    @ValidateIf((change: OfflineChangeDto) => change.id === undefined || change.catalogItemId !== undefined)
    @IsInt()
    public catalogItemId?: number;

    @IsISO8601()
    public changedAt: string;

    @IsOptional()
    @IsIn(['to_buy', 'recent'])
    public state?: ListState;

    @IsOptional()
    @IsInt()
    @Min(1)
    public quantity?: number;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    public note?: string;
}

export class OfflineChangesDto {
    @IsArray()
    @ArrayMaxSize(MAX_CHANGES)
    @ValidateNested({ each: true })
    @Type(() => OfflineChangeDto)
    public changes: Array<OfflineChangeDto>;
}
