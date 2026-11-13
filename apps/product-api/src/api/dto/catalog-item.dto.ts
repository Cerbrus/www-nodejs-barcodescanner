import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const MAX_NAME_LENGTH = 80;
const MAX_ICON_LENGTH = 80;
const MAX_EMOJI_LENGTH = 16;

export class CatalogItemCreateDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(MAX_NAME_LENGTH)
    public name: string;

    @IsString()
    @IsNotEmpty()
    public sectionId: string;

    @IsOptional()
    @IsString()
    @MaxLength(MAX_ICON_LENGTH)
    public icon?: string;

    @IsOptional()
    @IsString()
    @MaxLength(MAX_EMOJI_LENGTH)
    public emoji?: string;
}

export class CatalogItemUpdateDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(MAX_NAME_LENGTH)
    public name?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    public sectionId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(MAX_ICON_LENGTH)
    public icon?: string;

    @IsOptional()
    @IsString()
    @MaxLength(MAX_EMOJI_LENGTH)
    public emoji?: string;
}
