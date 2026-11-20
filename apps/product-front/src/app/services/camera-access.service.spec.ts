import { CameraAccessService } from './camera-access.service';

describe('CameraAccessService', () => {
    it('remembers that the camera was granted in this page load', () => {
        const access = new CameraAccessService();
        expect(access.granted).toBe(false);

        access.markGranted();

        expect(access.granted).toBe(true);
    });
});
