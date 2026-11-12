export interface AppSettings {
    api: {
        core: string;
    };
}

export type MicroserviceKey = keyof AppSettings['api'];
