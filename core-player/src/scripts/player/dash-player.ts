import bind from 'bind-decorator';
import DashPlugin from '@jsc/dash-player';
import { BasePlayer, ISharedPlayer, IMediaDataForLoad } from './base-player';
import { IMPDJsonData } from '../service/resolve.service';
import { CorePlayer } from '../core-player';
import { Quality } from '../utils/quality';
import { getCookie, getSearchParam } from '../utils/general';
import {
    FragmentLoadingAbandonedEvent,
    FragmentLoadingCompletedEvent,
    MediaPlayerEvents,
} from '@jsc/dash-player/release/dash';
import { VideoElementUtils } from '@shared/utils';
import { isBwpSupported } from '@jsc/wasm-player';
import { merge } from 'lodash-es';

export class DashPlayer extends BasePlayer implements ISharedPlayer {
    private dashPlayer!: DashPlugin.Player;

    readonly type = 'DASH';

    constructor(protected readonly player: CorePlayer, private readonly data: IMediaDataForLoad) {
        super(player);
        const softHEVCVideoTag = VideoElementUtils.createVideoElement(
            this.video,
            this.player.state.defQuality === 0 ? 0 : this.data.quality,
            (<IMPDJsonData>this.data.mediaDataSource?.url)?.video,
            isBwpSupported(),
            DashPlugin['isBwpHEVCPrefSupported'](),
        );
        if (softHEVCVideoTag) {
            this.video = <HTMLVideoElement>softHEVCVideoTag;
            this.video.volume = this.player.storage.volume;
        }
        this.load();
    }

    get typedInfo() {
        return {
            type: this.type,
            video: this.video,
            player: this.dashPlayer,
            hasPrefetchData: Boolean(
                this.data.mediaDataSource.preloadAVData && this.data.mediaDataSource.preloadAVData.type,
            ),
        };
    }

    get averageThroughput() {
        const d = this.dashPlayer.getCorePlayer();
        const vkbps = +d.getAverageThroughput('video');
        const akbps = +d.getAverageThroughput('audio');
        if (vkbps && akbps) {
            return ((vkbps + akbps) * 1000) / 1024 / 8 / 2;
        }
        if (vkbps) {
            return (vkbps * 1000) / 1024 / 8;
        }
        if (akbps) {
            return (akbps * 1000) / 1024 / 8;
        }
        return 0;
    }

    private load() {
        if (!Quality.isSuperQuality(this.data.quality) && this.data.quality > Quality.gtNeedBigWidth) {
            this.data.quality = Quality.gtNeedBigWidth;
        }
        // 强制仅高清清晰度
        if (this.player.config.highQuality === '1') {
            this.data.quality = 80;
            this.player.state.defQuality = 80;
        }

        const preloadData = Quality.isSuperQuality(this.data.quality)
            ? undefined
            : this.data.mediaDataSource.preloadAVData;

        let enableHEVC = true;
        if (preloadData && preloadData.video) {
            // 预取数据暂时关闭
            enableHEVC = false;
        }
        let defaultAudioQuality;
        if ((this.data.quality === 126 || this.player.storage.dolbyAtmos) && this.player.dolbyEffect) {
            this.player.storage.dolbyAtmos = true;
            defaultAudioQuality =
                Number(
                    (<IMPDJsonData>this.data.mediaDataSource?.url)?.dolby?.audio?.[0]?.id ||
                        (<IMPDJsonData>this.data.mediaDataSource?.url)?.audio?.[0]?.id,
                ) || 30280;
        } else {
            defaultAudioQuality = Number((<IMPDJsonData>this.data.mediaDataSource?.url)?.audio?.[0]?.id) || 30280;
        }
        this.dashPlayer = new DashPlugin(this.video, {
            defaultVideoQuality: this.data.quality,
            defaultAudioQuality,
            enableHEVC: enableHEVC,
            isAutoPlay: false,
            isDynamic: false,
            abrStrategy: DashPlugin.STRING.ABR_DYNAMIC,
            stableBufferTime: this.getDynamicBufferLength(),
            preloadData: preloadData,
        });
        this.dashPlayer
            .initialize(merge({}, this.data.mediaDataSource.url))
            .then(() => {
                if (this.dashPlayer) {
                    if (!Quality.isSuperQuality(this.data.quality) && this.player.state.defQuality === 0) {
                        this.dashPlayer.setAutoSwitchQualityFor('video', true);
                        // this.dashPlayer.setAutoSwitchQualityFor('audio', true);
                    }
                    const isLogin = Boolean(getCookie('DedeUserID'));
                    if (!isLogin) {
                        // TODO abtest field
                        this.dashPlayer.setAutoSwitchTopQualityFor('video', this.player.noLoginAutoQualityQt);
                    } else {
                        this.dashPlayer.setAutoSwitchTopQualityFor('video', Quality.gtNeedBigWidth);
                    }
                    // const dashCorePlayer = this.dashPlayer.getCorePlayer();
                    // dashCorePlayer.setBufferAheadToKeep(Quality.isSuperQuality(this.data.quality) ? 80 : 100);
                }
            })
            .catch((err) => {
                this.player.eventQueues.push({
                    type: 'dash_player_error',
                    timestamp: Date.now(),
                    params: [4000, 'dashPlayer initializing error.'],
                });
                this.player.defer.reject(this.player);
            });
        this.dashPlayer.on(DashPlugin.EVENTS.ERROR, this.onDashPlayerError);
        this.registerDashPlayerEvents();
    }

    private registerDashPlayerEvents() {
        const dashCorePlayer = this.dashPlayer.getCorePlayer();
        dashCorePlayer.on(DashPlugin.EVENTS.SOURCE_INITIALIZED, this.onSourceInitialized);
        dashCorePlayer.on(
            <MediaPlayerEvents['FRAGMENT_LOADING_ABANDONED']>DashPlugin.EVENTS.FRAGMENT_LOADING_ABANDONED,
            this.onHttpRequestEnded,
        );
        dashCorePlayer.on(
            <MediaPlayerEvents['FRAGMENT_LOADING_COMPLETED']>DashPlugin.EVENTS.FRAGMENT_LOADING_COMPLETED,
            this.onHttpRequestEnded,
        );
        // dashCorePlayer.on(DashPlugin.EVENTS.FRAGMENT_LOADING_ABANDONED, this.onHttpHeaderReceived);
        // dashCorePlayer.on(DashPlugin.EVENTS.FRAGMENT_LOADING_COMPLETED, this.onHttpHeaderReceived);
        dashCorePlayer.on(
            <MediaPlayerEvents['FRAGMENT_LOADING_COMPLETED']>DashPlugin.EVENTS.FRAGMENT_LOADING_COMPLETED,
            this.onAudioFrameDecoded,
        );
        dashCorePlayer.on(
            <MediaPlayerEvents['FRAGMENT_LOADING_COMPLETED']>DashPlugin.EVENTS.FRAGMENT_LOADING_COMPLETED,
            this.onVideoFrameDecoded,
        );
        this.dashPlayer.on(
            <MediaPlayerEvents['FRAGMENT_LOADING_COMPLETED']>DashPlugin.EVENTS.FRAGMENT_LOADING_COMPLETED,
            this.onVideoFrameLoaded,
        );
    }

    @bind
    private onDashPlayerError(e: any) {
        this.player.eventQueues.push({
            type: 'dash_player_error',
            timestamp: Date.now(),
            params: [e.code, e.msg],
        });
        this.player.defer.reject(this.player);
    }

    @bind
    private onHttpRequestEnded(e: FragmentLoadingAbandonedEvent | FragmentLoadingCompletedEvent) {
        const bytesLoaded: number = e.request['bytesLoaded'];
        if (bytesLoaded) {
            this.playerReceivedBytes += bytesLoaded;
        }
    }

    @bind
    private onHttpHeaderReceived(e: FragmentLoadingAbandonedEvent | FragmentLoadingCompletedEvent) {
        const requestStartDate = e.request['requestStartDate'];
        const headersReceivedDate = e.request['headersReceivedDate'];
        if (requestStartDate && headersReceivedDate) {
            this.player.reportQueues.push({
                type: 'http_connection_time',
                value: headersReceivedDate.getTime() - requestStartDate.getTime(),
                timestamp: Date.now(),
            });
        }
    }

    @bind
    private onAudioFrameDecoded(e: FragmentLoadingCompletedEvent) {
        const index: number = e.request['index'];
        const mediaType: string = e.request['mediaType'];
        if (index === 1 && mediaType === 'audio') {
            const dashCorePlayer = this.dashPlayer.getCorePlayer();
            const initializeDate = dashCorePlayer.getInitializeDate();
            const requestEndDate = e.request['requestEndDate'];
            if (initializeDate && requestEndDate) {
                this.player.reportQueues.push({
                    type: 'first_audio_frame_decoded',
                    value: requestEndDate.getTime() - initializeDate.getTime(),
                    timestamp: Date.now(),
                });
            }
            dashCorePlayer.off(DashPlugin.EVENTS.FRAGMENT_LOADING_COMPLETED, this.onAudioFrameDecoded);
        }
    }

    @bind
    private onVideoFrameDecoded(e: FragmentLoadingCompletedEvent) {
        const index: number = e.request['index'];
        const mediaType: string = e.request['mediaType'];
        if (index === 1 && mediaType === 'video') {
            const dashCorePlayer = this.dashPlayer.getCorePlayer();
            const initializeDate = dashCorePlayer.getInitializeDate();
            const requestEndDate = e.request['requestEndDate'];
            if (initializeDate && requestEndDate) {
                this.player.reportQueues.push({
                    type: 'first_video_frame_decoded',
                    value: requestEndDate.getTime() - initializeDate.getTime(),
                    timestamp: Date.now(),
                });
            }
            dashCorePlayer.off(DashPlugin.EVENTS.FRAGMENT_LOADING_COMPLETED, this.onVideoFrameDecoded);
        }
    }

    @bind
    private onSourceInitialized() {
        const dashCorePlayer = this.dashPlayer.getCorePlayer();
        const createdTime = dashCorePlayer.getInitializeDate().getTime();
        this.player.reportQueues.push({
            type: 'core_initial_time',
            value: Date.now() - createdTime,
            timestamp: Date.now(),
        });
        dashCorePlayer.off(DashPlugin.EVENTS.SOURCE_INITIALIZED, this.onSourceInitialized);
    }

    @bind
    private onVideoFrameLoaded(e: FragmentLoadingAbandonedEvent | FragmentLoadingCompletedEvent) {
        const index: number = e['index'];
        const mediaType: string = e['mediaType'];
        const qn: number = e['qn'];
        if (mediaType === 'video' && index >= 0) {
            this.playerReceivedVideoIndex.push(String(`${index}-${qn}`));
        }
        if (mediaType === 'audio' && index >= 0) {
            this.playerReceivedAudioIndex.push(String(`${index}-${qn}`));
        }
    }

    clearInteraction() {
        const dashCorePlayer = this.dashPlayer.getCorePlayer();
        if (!dashCorePlayer) {
            return;
        }
        dashCorePlayer.off(DashPlugin.EVENTS.SOURCE_INITIALIZED, this.onSourceInitialized);
        dashCorePlayer.off(DashPlugin.EVENTS.FRAGMENT_LOADING_ABANDONED, this.onHttpRequestEnded);
        dashCorePlayer.off(DashPlugin.EVENTS.FRAGMENT_LOADING_COMPLETED, this.onHttpRequestEnded);
        dashCorePlayer.off(DashPlugin.EVENTS.FRAGMENT_LOADING_ABANDONED, this.onHttpHeaderReceived);
        dashCorePlayer.off(DashPlugin.EVENTS.FRAGMENT_LOADING_COMPLETED, this.onHttpHeaderReceived);
        dashCorePlayer.off(DashPlugin.EVENTS.FRAGMENT_LOADING_COMPLETED, this.onAudioFrameDecoded);
        dashCorePlayer.off(DashPlugin.EVENTS.FRAGMENT_LOADING_COMPLETED, this.onVideoFrameDecoded);
        this.dashPlayer.off(DashPlugin.EVENTS.FRAGMENT_LOADING_COMPLETED, this.onVideoFrameLoaded);
        this.dashPlayer.off(DashPlugin.EVENTS.ERROR, this.onDashPlayerError);
    }

    getDynamicBufferLength() {
        const session = this.player.session;
        let dynamicBufferLength = 20;
        if (this.getPlayerIdle() === 'eg') {
            dynamicBufferLength = 60;
        } else if (this.getPlayerUserWhite() === 'eg1') {
            dynamicBufferLength = 40;
        } else if (this.getPlayerUserWhite() === 'eg2') {
            dynamicBufferLength = 60;
        }
        return dynamicBufferLength;
    }

    getPlayerIdle(): string {
        const url = <IMPDJsonData>this.data.mediaDataSource?.url;
        if (url && url.video && Number(getSearchParam('agrr', url.video[0]?.baseUrl)) > 0) {
            if (this.player.session && parseInt(this.player.session[0], 16) < 8) {
                return 'eg';
            } else {
                return 'cg';
            }
        } else {
            return '';
        }
    }

    getPlayerUserWhite(): string {
        const url = <IMPDJsonData>this.data.mediaDataSource?.url;
        if (url && url.video) {
            const uagrr = Number(getSearchParam('uagrr', url.video[0]?.baseUrl));
            if (uagrr === 1) {
                return 'eg1';
            } else if (uagrr === 2) {
                return 'eg2';
            } else if (uagrr === 3) {
                return 'cg';
            } else {
                return '';
            }
        } else {
            return '';
        }
    }

    destroy() {
        this.clearInteraction();
        this.dashPlayer.destroy();
    }
}
