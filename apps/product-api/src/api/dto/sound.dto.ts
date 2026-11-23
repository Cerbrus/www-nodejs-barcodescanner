import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

import { BLOCK_KINDS, BlockKind } from '@barcodescanner/shared';

import { MAX_BLOCKS, MAX_NAME_LENGTH } from '../../core/rules/sounds';

export class SoundBlockDto {
    @IsIn(BLOCK_KINDS)
    public kind: BlockKind;

    @IsInt()
    public ms: number;

    @IsOptional()
    @IsInt()
    public rate?: number;
}

export class SoundBlocksDto {
    @IsArray()
    @ArrayMaxSize(MAX_BLOCKS)
    @ValidateNested({ each: true })
    @Type(() => SoundBlockDto)
    public blocks: Array<SoundBlockDto>;
}

export class SoundDto extends SoundBlocksDto {
    @IsOptional()
    @IsString()
    @MaxLength(MAX_NAME_LENGTH)
    public name?: string;
}
