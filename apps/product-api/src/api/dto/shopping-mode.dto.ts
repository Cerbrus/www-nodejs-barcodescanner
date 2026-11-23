import { IsBoolean } from 'class-validator';

export class ShoppingModeDto {
    @IsBoolean()
    public on: boolean;
}
