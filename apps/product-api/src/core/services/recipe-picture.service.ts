import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

import { MAX_RECIPE_PICTURE_BYTES, RecipePictureSize } from '@barcodescanner/shared';

import { AppConfig } from '../../config/app.config';
import { isClosedAddress, pictureAddress } from '../rules/picture-source';

const TIMEOUT_MILLISECONDS = 10000;
const MAX_REDIRECTS = 3;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_PIXELS = 60_000_000;
const LARGE_WIDTH = 1600;
const SMALL_WIDTH = 600;
const SMALL_HEIGHT = 450;
const QUALITY = 80;
const MARK_LENGTH = 12;
const BACKGROUND = '#ffffff';

sharp.cache(false);

@Injectable()
export class RecipePictureService {
    constructor(private readonly config: AppConfig) {}

    public async download(source: string): Promise<Buffer> {
        let address = pictureAddress(source);
        for (let hop = 0; address && hop <= MAX_REDIRECTS; hop++) {
            await this.refuseClosed(new URL(address).hostname);
            const answer = await fetch(address, {
                redirect: 'manual',
                headers: { accept: 'image/*' },
                signal: AbortSignal.timeout(TIMEOUT_MILLISECONDS)
            });
            if (!REDIRECTS.has(answer.status)) {
                return this.bodyOf(answer);
            }
            const target = answer.headers.get('location');
            address = target && URL.canParse(target, address) ? pictureAddress(new URL(target, address).href) : '';
        }

        throw new Error('no address that may be fetched');
    }

    public async keep(recipeId: number, bytes: Buffer): Promise<string> {
        let large: Buffer;
        let small: Buffer;
        try {
            const upright = sharp(bytes, { limitInputPixels: MAX_PIXELS }).rotate().flatten({ background: BACKGROUND });
            [large, small] = await Promise.all([
                upright
                    .clone()
                    .resize({ width: LARGE_WIDTH, withoutEnlargement: true })
                    .jpeg({ quality: QUALITY })
                    .toBuffer(),
                upright
                    .clone()
                    .resize(SMALL_WIDTH, SMALL_HEIGHT, { fit: 'cover' })
                    .jpeg({ quality: QUALITY })
                    .toBuffer()
            ]);
        } catch {
            throw new BadRequestException('This is not a picture the app can read');
        }

        await mkdir(this.config.recipePicturesPath, { recursive: true });
        await writeFile(this.path(recipeId, 'large'), large);
        await writeFile(this.path(recipeId, 'small'), small);

        return createHash('sha1').update(large).digest('hex').slice(0, MARK_LENGTH);
    }

    public async read(recipeId: number, size: RecipePictureSize): Promise<Buffer | undefined> {
        try {
            return await readFile(this.path(recipeId, size));
        } catch {
            return undefined;
        }
    }

    public async remove(recipeId: number): Promise<void> {
        await rm(this.path(recipeId, 'large'), { force: true });
        await rm(this.path(recipeId, 'small'), { force: true });
    }

    private path(recipeId: number, size: RecipePictureSize): string {
        return join(this.config.recipePicturesPath, size === 'small' ? `${recipeId}-small.jpg` : `${recipeId}.jpg`);
    }

    private async refuseClosed(hostname: string): Promise<void> {
        const addresses = await lookup(hostname.replace(/^\[|\]$/g, ''), { all: true });
        if (!addresses.length || addresses.some(({ address }) => isClosedAddress(address))) {
            throw new Error(`${hostname} is not an address that may be fetched`);
        }
    }

    private async bodyOf(answer: Response): Promise<Buffer> {
        if (!answer.ok || !answer.body) {
            throw new Error(`the picture's host answered ${answer.status}`);
        }
        if (Number(answer.headers.get('content-length')) > MAX_RECIPE_PICTURE_BYTES) {
            throw new Error('the picture is too large');
        }

        const parts: Array<Uint8Array> = [];
        let size = 0;
        for await (const part of answer.body as unknown as AsyncIterable<Uint8Array>) {
            size += part.length;
            if (size > MAX_RECIPE_PICTURE_BYTES) {
                throw new Error('the picture is too large');
            }
            parts.push(part);
        }

        return Buffer.concat(parts);
    }
}
