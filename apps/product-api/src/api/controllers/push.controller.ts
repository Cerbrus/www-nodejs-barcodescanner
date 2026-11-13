import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';

import { PushResult, PushService } from '../../core/services/push.service';
import { PushEndpointDto, PushSubscriptionDto } from '../dto/push-subscription.dto';
import { OwnerOnly } from '../guards/owner.decorator';

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

    @OwnerOnly()
    @Post('test')
    @HttpCode(200)
    public sendTest(): Promise<PushResult> {
        return this.push.sendTest();
    }
}
