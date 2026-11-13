import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CatalogItemUpdateDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    public name?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    public sectionId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    public icon?: string;

    @IsOptional()
    @IsString()
    @MaxLength(16)
    public emoji?: string;
}

export class CatalogItemCreateDto extends CatalogItemUpdateDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    public override name: string;

    @IsString()
    @IsNotEmpty()
    public override sectionId: string;
}
