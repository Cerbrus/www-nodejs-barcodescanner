export interface SlackPollDto {
    channelId: string;
    messageId: string | null;
    pollId: string;
    start: Date;
}
