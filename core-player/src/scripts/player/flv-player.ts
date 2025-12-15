import bind from 'bind-decorator';
import FlvPlugin from '@jsc/flv.js';
import { Browser } from '../utils/browser';
import { ISharedPlayer, IMediaDataForLoad, BasePlayer } from './base-player';
import { CorePlayer } from '../core-player';

export class FlvPlayer extends BasePlayer implements ISharedPlayer {
    private flvPlayer!: FlvPlugin.Player;

    readonly type = 'FLV';

    constructor(protected readonly player: CorePlayer, private readonly data: IMediaDataForLoad) {
        super(player);
        this.load();
    }

    get typedInfo() {
        return {
            type: this.type,
            video: this.video,
            player: this.flvPlayer,
            hasPrefetchData: Boolean(this.data.mediaDataSource.prebuffer),
        };
    }

    get averageThroughput() {
        try {
            return this.flvPlayer['_transmuxer']['_controller']['_ioctl']['_speedSampler']['averageKBps'];
        } catch (e) {
            return 0;
        }
    }

    private load() {
        const config = {
            enableWorker: false,
            accurateSeek: true,
            stashInitialSize: 1024 * 64,
            seekType: this.data.seekType || 'param',
            rangeLoadZeroStart: false,
            lazyLoadMaxDuration: 100,
            lazyLoadRecoverDuration: 50,
            deferLoadAfterSourceOpen: false,
            fixAudioTimestampGap: false,
            reuseRedirectedURL: true,
        };
        if (Browser.safari.alike || Browser.edge.alike || Browser.trident.alike) {
            // Edge/IE may send Origin: blob:// insider worker. Disable for now.
            config.enableWorker = false;
            // Safari/Edge/IE use RangeLoader, set 2 min lazyLoad
            config.lazyLoadMaxDuration = 100;
        }
        FlvPlugin.LoggingControl.forceGlobalTag = true;
        FlvPlugin.LoggingControl.enableVerbose = false;

        this.flvPlayer = FlvPlugin.createPlayer(
            <FlvPlugin.MediaDataSource>this.data.mediaDataSource,
            <FlvPlugin.Config>config,
        );
        this.registerFlvPlayerEvents();
        this.flvPlayer.attachMediaElement(this.video);
        this.flvPlayer.load();
    }

    private registerFlvPlayerEvents() {
        this.flvPlayer.on(FlvPlugin.Events.ERROR, this.onFlvMediaError);
        this.flvPlayer.one(FlvPlugin.Events.LOADING_STARTED, this.onLoadingStarted);
        this.flvPlayer.on(FlvPlugin.Events.LOADING_COMPLETE, this.onLoadingComplete);
        this.flvPlayer.on(FlvPlugin.Events.HTTP_REQUEST_ENDED, this.onHttpRequestEnded);
        this.flvPlayer.on(FlvPlugin.Events.HTTP_HEADER_RECEIVED, this.onHttpHeaderReceived);
        this.flvPlayer.one(FlvPlugin.Events.AUDIO_FRAME_DECODED, this.onAudioFrameDecoded);
        this.flvPlayer.one(FlvPlugin.Events.VIDEO_FRAME_DECODED, this.onVideoFrameDecoded);
    }

    @bind
    private onFlvMediaError(...args: any[]) {
        this.player.eventQueues.push({
            type: 'video_preload_error',
            timestamp: Date.now(),
            params: args,
        });
        this.player.defer.reject(this.player);
    }

    @bind
    private onLoadingStarted(timestamp: number) {
        this.player.reportQueues.push({
            type: 'core_initial_time',
            value: timestamp - this.flvPlayer.createdTime,
            timestamp: Date.now(),
        });
    }

    @bind
    private onLoadingComplete(obj: object) {
        try {
            const metadata = obj['metadata'];
            const filesize = metadata['filesize'];
            const to = obj['to'];
            const requestUrl = obj['requestUrl'];
            if (filesize && to && filesize !== to + 1) {
                this.player.reportQueues.push({
                    type: 'abnormal_segment_bytelength',
                    value: `${filesize},${to + 1},${requestUrl}`,
                    timestamp: Date.now(),
                });
            }
        } catch (e) {
            // do nothing
        }
    }

    @bind
    private onHttpRequestEnded(totalBytes: number, requestUrl: string) {
        this.playerReceivedBytes += totalBytes;
    }

    @bind
    private onHttpHeaderReceived(elapsedTime: number, requestUrl: string) {
        this.player.reportQueues.push({
            type: 'http_connection_time',
            value: elapsedTime,
            timestamp: Date.now(),
        });
    }

    @bind
    private onAudioFrameDecoded(timestamp: number) {
        this.player.reportQueues.push({
            type: 'first_audio_frame_decoded',
            value: timestamp - this.flvPlayer.createdTime,
            timestamp: Date.now(),
        });
    }

    @bind
    private onVideoFrameDecoded(timestamp: number) {
        this.player.reportQueues.push({
            type: 'first_video_frame_decoded',
            value: timestamp - this.flvPlayer.createdTime,
            timestamp: Date.now(),
        });
    }

    clearInteraction() {
        this.flvPlayer.off(FlvPlugin.Events.ERROR, this.onFlvMediaError);
        this.flvPlayer.off(FlvPlugin.Events.LOADING_STARTED, this.onLoadingStarted);
        this.flvPlayer.off(FlvPlugin.Events.LOADING_COMPLETE, this.onLoadingComplete);
        this.flvPlayer.off(FlvPlugin.Events.HTTP_REQUEST_ENDED, this.onHttpRequestEnded);
        this.flvPlayer.off(FlvPlugin.Events.HTTP_HEADER_RECEIVED, this.onHttpHeaderReceived);
        this.flvPlayer.off(FlvPlugin.Events.AUDIO_FRAME_DECODED, this.onAudioFrameDecoded);
        this.flvPlayer.off(FlvPlugin.Events.VIDEO_FRAME_DECODED, this.onVideoFrameDecoded);
    }

    destroy() {
        this.clearInteraction();
        this.flvPlayer.destroy();
    }
}
