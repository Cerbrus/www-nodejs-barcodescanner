const ART = String.raw`
  ▐█▌█ ▌██▐ █▌▐█ █▌▌█▐█ ▌█▌▐██ ▌█▐▌ █▐█▌
  ▐█▌█ ▌██▐ █▌▐█ █▌▌█▐█ ▌█▌▐██ ▌█▐▌ █▐█▌
  ▐█▌█ ▌██▐ █▌▐█ █▌▌█▐█ ▌█▌▐██ ▌█▐▌ █▐█▌
━━▐█▌█━▌██▐━█▌▐█━█▌▌█▐█━▌█▌▐██━▌█▐▌━█▐█▌━━
  ▐█▌█ ▌██▐ █▌▐█ █▌▌█▐█ ▌█▌▐██ ▌█▐▌ █▐█▌
  ▐█▌█ ▌██▐ █▌▐█ █▌▌█▐█ ▌█▌▐██ ▌█▐▌ █▐█▌
  ▐█▌    B O O D S C H A P P E N    █▐█▌
`;

const ART_STYLE = 'color: #2dd4bf; font-family: ui-monospace, Menlo, Consolas, monospace; line-height: 1.05;';
const LABEL_STYLE = 'color: #9aa3af; font-family: ui-monospace, Menlo, Consolas, monospace;';
const VALUE_STYLE = 'color: inherit; font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 600;';
const LABEL_WIDTH = 12;

export interface BannerDetails {
    version?: string;
    commit?: string;
    builtAt?: string;
    apiBase: string;
    language: string;
}

export function printConsoleBanner(details: BannerDetails): void {
    const standalone =
        window.matchMedia('(display-mode: standalone)').matches || 'standalone' in navigator && navigator.standalone === true;
    const rows: Array<[string, string]> = [
        ['version', details.version ?? 'unknown (server not reachable)'],
        ['commit', details.commit ?? '-'],
        ['built', details.builtAt ?? '-'],
        ['api', new URL(details.apiBase, window.location.origin).href],
        ['page', window.location.href],
        ['language', details.language],
        ['installed', standalone ? 'yes, running as an app' : 'no, running in a browser tab'],
        ['online', String(navigator.onLine)],
        ['viewport', `${window.innerWidth} × ${window.innerHeight} @ ${window.devicePixelRatio}x`],
        ['camera', window.isSecureContext && 'mediaDevices' in navigator ? 'available' : 'not available (needs HTTPS)'],
        ['started', new Date().toISOString()],
        ['browser', navigator.userAgent]
    ];

    console.log(`%c${ART}`, ART_STYLE);
    for (const [label, value] of rows) {
        console.log(`%c${label.padEnd(LABEL_WIDTH)}%c${value}`, LABEL_STYLE, VALUE_STYLE);
    }
    console.log('%cLive log of scanner and server: /log   ·   scan history: /history', LABEL_STYLE);
}

declare global {
    interface Navigator {
        standalone?: boolean;
    }
}
