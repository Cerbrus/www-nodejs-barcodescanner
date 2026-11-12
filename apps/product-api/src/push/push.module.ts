import { Body, Controller, Delete, Get, HttpCode, Module, Post } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

import { PushResult, PushService } from './push.service';
import { BarcodeEntity, PushSubscriptionEntity } from '../data/entities';

class PushSubscriptionDto {
    @IsUrl({ protocols: ['https'], require_protocol: true })
    @MaxLength(1000)
    public endpoint: string;

    @IsString()
    @MaxLength(200)
    public p256dh: string;

    @IsString()
    @MaxLength(200)
    public auth: string;

    @IsOptional()
    @IsIn(['nl', 'en'])
    public language?: string;

    @IsOptional()
    @IsUrl({ protocols: ['https', 'http'], require_protocol: true, require_tld: false })
    @MaxLength(200)
    public origin?: string;
}

class PushEndpointDto {
    @IsString()
    @MaxLength(1000)
    public endpoint: string;
}

@Controller({ path: 'push', version: '1' })
export class PushController {
    constructor(private readonly push: PushService) {
    }

    @Get('key')
    public getKey(): { publicKey: string } {
        return { publicKey: this.push.publicKey };
    }

    @Post('subscriptions')
    @HttpCode(204)
    public subscribe(@Body() subscription: PushSubscriptionDto): Promise<void> {
        return this.push.subscribe(subscription);
    }

    @Delete('subscriptions')
    @HttpCode(204)
    public unsubscribe(@Body() subscription: PushEndpointDto): Promise<void> {
        return this.push.unsubscribe(subscription.endpoint);
    }

    @Post('test')
    @HttpCode(200)
    public sendTest(): Promise<PushResult> {
        return this.push.sendTest();
    }
}

@Module({
    imports: [TypeOrmModule.forFeature([PushSubscriptionEntity, BarcodeEntity])],
    controllers: [PushController],
    providers: [PushService],
    exports: [PushService]
})
export class PushModule {
}
