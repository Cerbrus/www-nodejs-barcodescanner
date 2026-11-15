import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';

import { IssueDraft, IssueOptions } from '../../core/rules/remarks';
import { RemarkService } from '../../core/services/remark.service';
import { RemarkEntity } from '../../data/entities';
import { RemarkCreateDto, RemarkIssueDto, RemarkStateDto } from '../dto/remark.dto';
import { CurrentAccount } from '../guards/account.decorator';
import { OwnerOnly } from '../guards/owner.decorator';
import { Account } from '../http';

interface RemarkList {
    remarks: Array<RemarkEntity>;
    canSendToGitHub: boolean;
}

const issueOptions = (choice: RemarkIssueDto): IssueOptions => ({
    includeDevice: choice.includeDevice ?? false,
    includeAccount: choice.includeAccount ?? false,
    investigate: choice.investigate ?? false
});

@Controller({ path: 'remarks', version: '1' })
export class RemarkController {
    constructor(private readonly remarks: RemarkService) {
    }

    @Post()
    public async create(@Body() remark: RemarkCreateDto, @CurrentAccount() account: Account): Promise<{ id: number }> {
        return { id: (await this.remarks.create(account, remark)).id };
    }

    @Get()
    public async list(@CurrentAccount() account: Account): Promise<RemarkList> {
        return { remarks: await this.remarks.list(account), canSendToGitHub: account.owner && this.remarks.canSendToGitHub };
    }

    @OwnerOnly()
    @Patch(':id')
    public setState(@Param('id', ParseIntPipe) id: number, @Body() change: RemarkStateDto): Promise<RemarkEntity> {
        return this.remarks.setState(id, change.state);
    }

    @Delete(':id')
    @HttpCode(204)
    public reject(@Param('id', ParseIntPipe) id: number, @CurrentAccount() account: Account): Promise<void> {
        return this.remarks.reject(account, id);
    }

    @OwnerOnly()
    @Post(':id/issue-draft')
    @HttpCode(200)
    public issueDraft(@Param('id', ParseIntPipe) id: number, @Body() choice: RemarkIssueDto): Promise<IssueDraft> {
        return this.remarks.issueDraft(id, issueOptions(choice));
    }

    @OwnerOnly()
    @Post(':id/issue')
    @HttpCode(200)
    public sendToGitHub(@Param('id', ParseIntPipe) id: number, @Body() choice: RemarkIssueDto): Promise<RemarkEntity> {
        return this.remarks.sendToGitHub(id, issueOptions(choice));
    }
}
