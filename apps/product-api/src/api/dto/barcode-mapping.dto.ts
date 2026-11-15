import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class BarcodeMappingDto {
    @IsInt()
    public catalogItemId: number;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    public note?: string;
}
