import { Body, Controller, HttpCode, Logger, Module, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

import { EventsModule } from '../events/events.module';
import { EventsService } from '../events/events.service';

const MAX_STEPS = 24;
const MAX_STEP_SECONDS = 2;
const MAX_GATE_HERTZ = 5000;

class SoundStepDto {
    @IsIn(['on', 'off', 'gate'])
    public kind: 'on' | 'off' | 'gate';

    @IsNumber()
    @Min(0.01)
    @Max(MAX_STEP_SECONDS)
    public seconds: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(MAX_GATE_HERTZ)
    public hz?: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(99)
    public duty?: number;
}

class SoundTestDto {
    @IsString()
    @MaxLength(60)
    public name: string;

    @ArrayMinSize(1)
    @ArrayMaxSize(MAX_STEPS)
    @ValidateNested({ each: true })
    @Type(() => SoundStepDto)
    public steps: Array<SoundStepDto>;
}

@Controller({ path: 'feedback', version: '1' })
export class FeedbackController {
    private readonly logger = new Logger('Feedback');

    constructor(private readonly events: EventsService) {
    }

    @Post('test')
    @HttpCode(202)
    public test(@Body() sound: SoundTestDto): void {
        this.logger.log(`test sound "${sound.name}" sent to the scanner`);
        this.events.emit('feedback', { name: sound.name, steps: sound.steps });
    }
}

@Module({
    imports: [EventsModule],
    controllers: [FeedbackController]
})
export class FeedbackModule {
}
