import {
    BadRequestException,
    ConflictException,
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Not, Repository } from 'typeorm';

import { IssueDraft, IssueOptions, IssueProgress, RemarkKind } from '@barcodescanner/shared';

import { AppConfig } from '../../config/app.config';
import { RemarkEntity } from '../../data/entities';
import {
    REJECTED_STATE,
    RemarkState,
    cleanContext,
    cleanTarget,
    isFinalStage,
    issueFromRemark,
    progressOfIssue,
    tooManyRemarks,
    withRelease
} from '../rules/remarks';
import { EventsService } from './events.service';
import { GitHubService } from './github.service';
import { PushService } from './push.service';

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
const PROGRESS_MAX_AGE = 60 * 1000;

@Injectable()
export class RemarkService {
    private readonly logger = new Logger('Remarks');
    private readonly releases = new Map<number, string>();
    private readonly progressCache = new Map<number, { progress: IssueProgress; at: number }>();

    constructor(
        @InjectRepository(RemarkEntity) private readonly remarks: Repository<RemarkEntity>,
        private readonly github: GitHubService,
        private readonly push: PushService,
        private readonly events: EventsService,
        private readonly config: AppConfig
    ) {}

    public get canSendToGitHub(): boolean {
        return this.github.enabled;
    }

    public async create(writer: RemarkWriter, input: RemarkInput, now = new Date()): Promise<RemarkEntity> {
        const recent = await this.remarks.count({
            where: { account: writer.email, createdAt: MoreThan(new Date(now.getTime() - HOUR_MILLISECONDS)) }
        });
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
        return this.remarks.find({
            where: { state: Not(REJECTED_STATE), ...(reader.owner ? {} : { account: reader.email }) },
            order: { createdAt: 'DESC', id: 'DESC' }
        });
    }

    public async progressOf(remarks: Array<RemarkEntity>, now = Date.now()): Promise<Map<number, IssueProgress>> {
        const known = new Map<number, IssueProgress>();
        if (!this.github.enabled) {
            return known;
        }

        await Promise.all(
            remarks
                .filter((remark) => remark.issueNumber)
                .map(async (remark) => {
                    const progress = await this.progressOfIssue(remark.issueNumber as number, now);
                    if (progress) {
                        known.set(remark.id, progress);
                    }
                })
        );

        return known;
    }

    public async setState(id: number, state: RemarkState): Promise<RemarkEntity> {
        const remark = await this.get(id);

        return this.remarks.save({ ...remark, state, closedAt: state === 'closed' ? new Date() : null });
    }

    public async edit(writer: RemarkWriter, id: number, text: string, kind?: RemarkKind): Promise<RemarkEntity> {
        if (!text.trim()) {
            throw new BadRequestException('A remark needs text');
        }
        const remark = await this.get(id);
        if (!writer.owner && remark.account !== writer.email) {
            throw new NotFoundException(`Remark ${id} not found`);
        }
        if (remark.issueUrl) {
            throw new ConflictException('This remark is already on GitHub');
        }

        const saved = await this.remarks.save({ ...remark, text: text.trim(), kind: kind ?? remark.kind });
        this.logger.log(`remark ${id} edited`);

        return saved;
    }

    public async reject(writer: RemarkWriter, id: number): Promise<void> {
        const remark = await this.get(id);
        if (!writer.owner && remark.account !== writer.email) {
            throw new NotFoundException(`Remark ${id} not found`);
        }
        if (remark.issueUrl) {
            throw new ConflictException('This remark is already on GitHub');
        }

        await this.remarks.save({ ...remark, state: REJECTED_STATE, closedAt: new Date() });
        this.logger.log(`remark ${id} rejected`);
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

    private async progressOfIssue(number: number, now: number): Promise<IssueProgress | undefined> {
        const cached = this.progressCache.get(number);
        if (cached && (isFinalStage(cached.progress.stage) || now - cached.at < PROGRESS_MAX_AGE)) {
            return cached.progress;
        }

        const snapshot = await this.github.issueSnapshot(number);
        if (!snapshot) {
            return cached?.progress;
        }
        const progress = await this.withRelease(progressOfIssue(snapshot));
        this.progressCache.set(number, { progress, at: now });

        return progress;
    }

    private async withRelease(progress: IssueProgress): Promise<IssueProgress> {
        const pull = progress.stage === 'merged' ? progress.pullRequest?.number : undefined;
        if (pull === undefined) {
            return progress;
        }
        const version = this.releases.get(pull) ?? (await this.github.releaseOf(pull));
        if (version) {
            this.releases.set(pull, version);
        }

        return withRelease(progress, version, this.config.version);
    }

    private async get(id: number): Promise<RemarkEntity> {
        const remark = await this.remarks.findOne({ where: { id, state: Not(REJECTED_STATE) } });
        if (!remark) {
            throw new NotFoundException(`Remark ${id} not found`);
        }

        return remark;
    }
}
