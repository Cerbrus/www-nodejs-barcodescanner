import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { ListState } from '../../data/entities';

export class ListEntryChangeDto {
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
