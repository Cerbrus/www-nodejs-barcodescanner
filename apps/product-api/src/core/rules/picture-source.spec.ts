import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isClosedAddress, pictureAddress } from './picture-source';

describe('the address of a picture', () => {
    it('takes an https address and nothing else', () => {
        assert.equal(pictureAddress(' https://static.example.com/a/b.jpg '), 'https://static.example.com/a/b.jpg');
        assert.equal(pictureAddress('http://static.example.com/b.jpg'), '');
        assert.equal(pictureAddress('file:///etc/passwd'), '');
        assert.equal(pictureAddress('data:image/png;base64,AAAA'), '');
        assert.equal(pictureAddress('https://user:secret@example.com/b.jpg'), '');
        assert.equal(pictureAddress('b.jpg'), '');
        assert.equal(pictureAddress(''), '');
        assert.equal(pictureAddress(undefined), '');
        assert.equal(pictureAddress(`https://example.com/${'a'.repeat(2000)}`), '');
    });

    it('refuses an address inside the home network or on the machine itself', () => {
        for (const address of [
            '127.0.0.1',
            '10.1.2.3',
            '172.16.0.1',
            '172.31.255.255',
            '192.168.1.86',
            '169.254.169.254',
            '100.64.0.1',
            '0.0.0.0',
            '::1',
            '::',
            'fe80::1',
            'fd12:3456::1',
            '::ffff:192.168.1.1',
            'not an address'
        ]) {
            assert.equal(isClosedAddress(address), true, address);
        }
        for (const address of ['8.8.8.8', '172.32.0.1', '104.16.1.1', '2a00:1450:400e::200e', '::ffff:8.8.8.8']) {
            assert.equal(isClosedAddress(address), false, address);
        }
    });
});
