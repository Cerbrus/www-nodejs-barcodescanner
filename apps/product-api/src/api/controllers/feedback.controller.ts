import { Body, Controller, Delete, Get, HttpCode, Param, ParseEnumPipe, Post, Put } from '@nestjs/common';

import { FEEDBACK_EVENTS, FeedbackEvent } from '../../core/rules/sounds';
import { FeedbackService, FeedbackSettings } from '../../core/services/feedback.service';
import { SoundChoiceDto } from '../dto/sound-choice.dto';
import { SoundBlocksDto, SoundDto } from '../dto/sound.dto';
import { Agent } from '../guards/agent.decorator';
import { OwnerOnly } from '../guards/owner.decorator';

@Controller({ path: 'feedback', version: '1' })
export class FeedbackController {
    constructor(private readonly feedback: FeedbackService) {}

    @OwnerOnly()
    @Agent()
    @Get('settings')
    public getSettings(): Promise<FeedbackSettings> {
        return this.feedback.getSettings();
    }

    @OwnerOnly()
    @Put('settings/:event')
    public setSound(
        @Param('event', new ParseEnumPipe(FEEDBACK_EVENTS)) event: FeedbackEvent,
        @Body() choice: SoundChoiceDto
    ): Promise<FeedbackSettings> {
        return this.feedback.setSound(event, choice.soundId);
    }

    @OwnerOnly()
    @Post('test')
    @HttpCode(202)
    public test(@Body() choice: SoundChoiceDto): Promise<void> {
        return this.feedback.test(choice.soundId);
    }

    @OwnerOnly()
    @Post('test-blocks')
    @HttpCode(202)
    public testBlocks(@Body() sound: SoundBlocksDto): void {
        this.feedback.testBlocks(sound.blocks);
    }

    @OwnerOnly()
    @Post('sounds')
    public createSound(@Body() sound: SoundDto): Promise<FeedbackSettings> {
        return this.feedback.createSound(sound.name ?? '', sound.blocks);
    }

    @OwnerOnly()
    @Put('sounds/:id')
    public changeSound(@Param('id') id: string, @Body() sound: SoundDto): Promise<FeedbackSettings> {
        return this.feedback.changeSound(id, sound.name, sound.blocks);
    }

    @OwnerOnly()
    @Delete('sounds/:id')
    public deleteSound(@Param('id') id: string): Promise<FeedbackSettings> {
        return this.feedback.deleteSound(id);
    }
}
