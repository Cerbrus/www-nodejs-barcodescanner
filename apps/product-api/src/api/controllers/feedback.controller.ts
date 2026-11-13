import { Body, Controller, Get, HttpCode, Param, ParseEnumPipe, Post, Put } from '@nestjs/common';

import { FEEDBACK_EVENTS, FeedbackEvent } from '../../core/rules/sounds';
import { FeedbackService, FeedbackSettings } from '../../core/services/feedback.service';
import { SoundChoiceDto } from '../dto/sound-choice.dto';
import { Agent } from '../guards/agent.decorator';

@Controller({ path: 'feedback', version: '1' })
export class FeedbackController {
    constructor(private readonly feedback: FeedbackService) {
    }

    @Agent()
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
