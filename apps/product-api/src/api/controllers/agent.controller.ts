import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';

import { AgentStatus, AgentStatusService } from '../../core/services/agent-status.service';
import { ScanService } from '../../core/services/scan.service';
import { AgentStatusDto } from '../dto/agent-status.dto';
import { Agent } from '../guards/agent.decorator';
import { OwnerOnly } from '../guards/owner.decorator';

@Controller({ path: 'agent', version: '1' })
export class AgentController {
    constructor(
        private readonly agent: AgentStatusService,
        private readonly scans: ScanService
    ) {
    }

    @OwnerOnly()
    @Get('status')
    public async getStatus(): Promise<AgentStatus & { lastHandheldScanAt?: Date }> {
        return { ...this.agent.status, lastHandheldScanAt: await this.scans.lastScanAt('handheld') };
    }

    @Agent()
    @Post('status')
    @HttpCode(204)
    public report(@Body() status: AgentStatusDto): void {
        this.agent.report(status.scanner, status.device);
    }
}
