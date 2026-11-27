import { BlockList, isIP } from 'node:net';

import { MAX_RECIPE_SOURCE_URL_LENGTH } from '@barcodescanner/shared';

const IPV4_MAPPED = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

const closed = new BlockList();
for (const [network, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['224.0.0.0', 3]
] as Array<[string, number]>) {
    closed.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
    ['::', 127],
    ['64:ff9b::', 96],
    ['fc00::', 7],
    ['fe80::', 10],
    ['ff00::', 8]
] as Array<[string, number]>) {
    closed.addSubnet(network, prefix, 'ipv6');
}

export function pictureAddress(value: unknown): string {
    if (typeof value !== 'string' || value.length > MAX_RECIPE_SOURCE_URL_LENGTH || !URL.canParse(value.trim())) {
        return '';
    }
    const address = new URL(value.trim());

    return address.protocol === 'https:' && !address.username && !address.password ? address.href : '';
}

export function isClosedAddress(address: string): boolean {
    const mapped = IPV4_MAPPED.exec(address)?.[1];
    const plain = mapped ?? address;
    const family = isIP(plain);

    return !family || closed.check(plain, family === 4 ? 'ipv4' : 'ipv6');
}
