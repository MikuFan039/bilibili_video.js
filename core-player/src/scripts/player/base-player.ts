import { IMediaDataSource } from '../service/resolve.service';
import { CorePlayer } from '../core-player';
import FlvPlugin from '@jsc/flv.js';
import DashPlugin from '@jsc/dash-player';

/**
 * All properties are optional
 */
export interface IPreloadAVData {
    type?: string;
    qn: string;
    video: string;
    videoid: string;
    audio: string;
    audioid: string;
}

export interface IMediaDataForLoad {
    mediaDataSource: IMediaDataSource;
    quality: number;
    seekType?: string;
    preloadAVData?: IPreloadAVData;
}

export interface ITypedPlayerInfo {
    type: string;
    video: HTMLVideoElement;
    player: FlvPlugin.Player | DashPlugin.Player;
    hasPrefetchData: boolean;
}

export interface ISharedPlayer {
    readonly type: string;
    readonly video: HTMLVideoElement;
    readonly averageThroughput: number; // Unit: KiBps
    readonly currentReceivedBytes: number;
    readonly currentReceivedAudioIndex: Array<string>;
    readonly currentReceivedVideoIndex: Array<string>;
    readonly typedInfo: ITypedPlayerInfo;
    clearInteraction(): void;
    destroy(): void;
}

export abstract class BasePlayer {
    protected playerReceivedBytes = 0;
    protected playerReceivedAudioIndex: Array<string> = [];
    protected playerReceivedVideoIndex: Array<string> = [];

    video = document.createElement('video');

    protected constructor(protected readonly player: CorePlayer) {
        this.video.volume = this.player.storage.volume;
        this.video.crossOrigin = 'anonymous';
    }

    get currentReceivedBytes() {
        return this.playerReceivedBytes;
    }

    get currentReceivedAudioIndex() {
        return this.playerReceivedAudioIndex;
    }

    get currentReceivedVideoIndex() {
        return this.playerReceivedVideoIndex;
    }
}
