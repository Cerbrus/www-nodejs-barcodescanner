import { IsOptional } from 'class-validator';

export class ProductFilterDto {
    @IsOptional()
    name?: string;
}
