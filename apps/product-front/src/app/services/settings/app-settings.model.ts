export interface AppSettings {
    api: {
        core: string;
        slack: string;
    };
}

const MicroserviceKeys = ['core', 'slack'] as const;
export type MicroserviceKey = (typeof MicroserviceKeys)[number];
