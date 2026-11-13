import { IsInt } from 'class-validator';

export class BarcodeMappingDto {
    @IsInt()
    public catalogItemId: number;
}
