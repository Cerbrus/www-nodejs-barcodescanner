import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import { ContentPolicyService } from '../../core/services/content-policy.service';
import { Public } from '../guards/public.decorator';

@Public()
@Controller({ path: 'csp-reports', version: '1' })
export class ContentPolicyController {
    constructor(private readonly policy: ContentPolicyService) {
    }

    @Post()
    @HttpCode(204)
    public report(@Body() body: unknown): void {
        this.policy.report(body);
    }
}
