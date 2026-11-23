import { Body, Controller, Get, Put } from '@nestjs/common';

import { SettingService } from '../../core/services/setting.service';
import { ShoppingModeDto } from '../dto/shopping-mode.dto';

@Controller({ path: 'shopping-mode', version: '1' })
export class ShoppingModeController {
    constructor(private readonly settings: SettingService) {}

    @Get()
    public async get(): Promise<ShoppingModeDto> {
        return { on: await this.settings.shoppingMode() };
    }

    @Put()
    public async set(@Body() mode: ShoppingModeDto): Promise<ShoppingModeDto> {
        return { on: await this.settings.setShoppingMode(mode.on) };
    }
}
