import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsISO8601, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

import { ListState } from '../../data/entities';

const MAX_CHANGES = 200;

export class OfflineChangeDto {
    @IsInt()
    public catalogItemId: number;

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
