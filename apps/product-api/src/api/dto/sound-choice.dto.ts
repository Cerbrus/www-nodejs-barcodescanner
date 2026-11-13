import { IsString, MaxLength } from 'class-validator';

export class SoundChoiceDto {
    @IsString()
    @MaxLength(40)
    public soundId: string;
}
