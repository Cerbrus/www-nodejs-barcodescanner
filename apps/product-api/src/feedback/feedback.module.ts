import { Body, Controller, Get, HttpCode, Module, Param, ParseEnumPipe, Post, Put } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IsString, MaxLength } from 'class-validator';

import { FeedbackService, FeedbackSettings } from './feedback.service';
import { FEEDBACK_EVENTS, FeedbackEvent } from './sounds';
import { FeedbackSettingEntity } from '../data/entities';
import { EventsModule } from '../events/events.module';

class SoundChoiceDto {
    @IsString()
    @MaxLength(40)
    public soundId: string;
}

@Controller({ path: 'feedback', version: '1' })
export class FeedbackController {
    constructor(private readonly feedback: FeedbackService) {
    }

    @Get('settings')
    public getSettings(): Promise<FeedbackSettings> {
        return this.feedback.getSettings();
    }

    @Put('settings/:event')
    public setSound(
        @Param('event', new ParseEnumPipe(FEEDBACK_EVENTS)) event: FeedbackEvent,
        @Body() choice: SoundChoiceDto
    ): Promise<FeedbackSettings> {
        return this.feedback.setSound(event, choice.soundId);
    }

    @Post('test')
    @HttpCode(202)
    public test(@Body() choice: SoundChoiceDto): void {
        this.feedback.test(choice.soundId);
    }
}

@Module({
    imports: [TypeOrmModule.forFeature([FeedbackSettingEntity]), EventsModule],
    controllers: [FeedbackController],
    providers: [FeedbackService],
    exports: [FeedbackService]
})
export class FeedbackModule {
}
