import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';

import { PushResult, PushService } from '../../core/services/push.service';
import { PushEndpointDto, PushSubscriptionDto } from '../dto/push-subscription.dto';
import { CurrentAccount } from '../guards/account.decorator';
import { OwnerOnly } from '../guards/owner.decorator';
import { Account } from '../http';

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
    public subscribe(@Body() subscription: PushSubscriptionDto, @CurrentAccount() account: Account): Promise<void> {
        return this.push.subscribe(subscription, account.email);
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
