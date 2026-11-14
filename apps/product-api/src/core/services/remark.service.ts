import { ConflictException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';

import { EventsService } from './events.service';
import { GitHubService } from './github.service';
import { PushService } from './push.service';
import { RemarkEntity } from '../../data/entities';
import { IssueDraft, IssueOptions, RemarkKind, RemarkState, cleanContext, cleanTarget, issueFromRemark, tooManyRemarks } from '../rules/remarks';

export interface RemarkInput {
    kind: RemarkKind;
    text: string;
    page?: string;
    target?: unknown;
    context?: unknown;
    writtenAt?: Date;
}

export interface RemarkWriter {
    email: string;
    owner: boolean;
}

const HOUR_MILLISECONDS = 60 * 60 * 1000;
const MAX_PAGE_LENGTH = 200;

@Injectable()
export class RemarkService {
    private readonly logger = new Logger('Remarks');

    constructor(
        @InjectRepository(RemarkEntity) private readonly remarks: Repository<RemarkEntity>,
        private readonly github: GitHubService,
        private readonly push: PushService,
        private readonly events: EventsService
    ) {
    }

    public get canSendToGitHub(): boolean {
        return this.github.enabled;
    }

    public async create(writer: RemarkWriter, input: RemarkInput, now = new Date()): Promise<RemarkEntity> {
        const recent = await this.remarks.count({ where: { account: writer.email, createdAt: MoreThan(new Date(now.getTime() - HOUR_MILLISECONDS)) } });
        if (tooManyRemarks(recent)) {
            throw new HttpException('Too many remarks in the last hour', HttpStatus.TOO_MANY_REQUESTS);
        }

        const remark = await this.remarks.save({
            kind: input.kind,
            text: input.text.trim(),
            state: 'open',
            page: (input.page ?? '').slice(0, MAX_PAGE_LENGTH),
            target: cleanTarget(input.target) ?? null,
            context: cleanContext(input.context),
            account: writer.email,
            createdAt: input.writtenAt && input.writtenAt < now ? input.writtenAt : now
        });

        this.logger.log(`remark ${remark.id} (${remark.kind}) written on ${remark.page || 'an unknown page'}`);
        this.events.emit('remark', { id: remark.id, kind: remark.kind, fromOwner: writer.owner });
        if (!writer.owner) {
            void this.push.notifyOwnerOfRemark(remark.id, remark.kind, remark.text);
        }

        return remark;
    }

    public list(reader: RemarkWriter): Promise<Array<RemarkEntity>> {
        return this.remarks.find({ where: reader.owner ? {} : { account: reader.email }, order: { createdAt: 'DESC', id: 'DESC' } });
    }

    public async setState(id: number, state: RemarkState): Promise<RemarkEntity> {
        const remark = await this.get(id);

        return this.remarks.save({ ...remark, state, closedAt: state === 'closed' ? new Date() : null });
    }

    public async issueDraft(id: number, options: IssueOptions): Promise<IssueDraft> {
        return issueFromRemark(await this.get(id), options);
    }

    public async sendToGitHub(id: number, options: IssueOptions): Promise<RemarkEntity> {
        const remark = await this.get(id);
        if (remark.issueUrl) {
            throw new ConflictException('This remark is already on GitHub');
        }

        const issue = await this.github.createIssue(issueFromRemark(remark, options));

        return this.remarks.save({ ...remark, issueNumber: issue.number, issueUrl: issue.url });
    }

    private async get(id: number): Promise<RemarkEntity> {
        const remark = await this.remarks.findOne({ where: { id } });
        if (!remark) {
            throw new NotFoundException(`Remark ${id} not found`);
        }

        return remark;
    }
}
