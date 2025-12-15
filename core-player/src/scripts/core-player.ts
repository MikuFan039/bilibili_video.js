import md5 from 'md5';
import qs from 'qs';
import bind from 'bind-decorator';
import coreStyle from '../index.lazy.less';
import FlvPlugin from '@jsc/flv.js';
import { FlvPlayer } from './player/flv-player';
import { DashPlayer } from './player/dash-player';
import { IMediaDataForLoad, ISharedPlayer } from './player/base-player';
import { OptionsService, IPlayerConfig } from './service/options.service';
import { IStorageConfig, StorageService } from './service/storage.service';
import { IResolveParams, ResolveService, HOSTCONFIG } from './service/resolve.service';
import { frameView } from './views/frame';
import { Browser } from './utils/browser';
import { Quality } from './utils/quality';
import { Deferred } from './utils/deferred';
import { getCookie, setCookie, getHiddenProp, isDocumentHidden, thumbnail } from './utils/general';
import { defQuality } from './config/video';
import { K_PLAYER_PREFIX } from './config/base';
import { ContentType, EventType } from '@jsc/namespace';
import axios from 'axios';
import feedback from './../images/feedback.svg';
import { noop } from '@shared/utils';
import { VideoElementUtils } from '@shared/utils';

interface IReportQueuesItem {
    type: string;
    value: number | string;
    timestamp: number;
}

interface IEventQueuesItem {
    type: string;
    timestamp: number;
    params?: any[];
}

interface ICorePlayerState {
    allowFlv: boolean;
    fixTime: number;
    lastVideoTime: number;
    defQuality: number;
    errorPlayurl: boolean;
    isBuffering: boolean;
}

interface IReportTimestamp {
    playurl_start: number;
    playurl_end: number;
    loadmetadata_start: number;
    loadmetadata_end: number;
}

interface IGeneralJNode {
    area?: HTMLElement | null;
    videoWrap?: HTMLElement | null;
    loadingPanel?: HTMLElement | null;
    loadingPanelDetail?: HTMLElement | null;
    loadingPanelText?: HTMLElement | null;
    poster?: HTMLElement | null;
    issue?: HTMLElement | null;
    loadPoster?: HTMLElement | null;
}

/**
 * @desc playurl fnval类型（由playurl接口定义）
 * - 0 优先返回 flv 格式视频地址
 * - 1 只返回 mp4 格式的视频地址
 * - 16 优先返回 DASH-H265 视频的JSON内容
 * - 64 优先返回 HDR 的视频地址
 * - 128 优先返回 4K 的视频地址
 * - 256 优先返回 杜比音频 的视频地址
 * - 512 优先返回 杜比视界 的视频地址
 * - 1024 优先返回 8K 的视频地址
 */
export enum FNVAL_TYPE {
    FLV = 0,
    MP4 = 1,
    DASH_H265 = 16,
    HDR = 64,
    DASH_4K = 128,
    DOLBYAUDIO = 256,
    DOLBYVIDEO = 512,
    DASH_8K = 1024,
}

export class CorePlayer {
    private sharedPlayer?: ISharedPlayer;
    private bufferingTimer!: number;
    private hiddenStartTime!: number;
    private loadTimeOut = 0;

    readonly rts: IReportTimestamp = {
        playurl_start: 0,
        playurl_end: 0,
        loadmetadata_start: 0,
        loadmetadata_end: 0,
    };

    readonly ccl = window; // Current Context Layer
    readonly ucl: Window; // Upper Context Layer
    readonly defer = new Deferred();
    readonly prefix = K_PLAYER_PREFIX;
    readonly state: ICorePlayerState = {
        fixTime: 0,
        lastVideoTime: 0,
        defQuality: 0,
        allowFlv: false,
        errorPlayurl: false,
        isBuffering: false,
    };
    readonly jnode: IGeneralJNode = {};
    readonly eventQueues: IEventQueuesItem[] = [];
    readonly reportQueues: IReportQueuesItem[] = [];
    readonly frameChildNodes: ChildNode[] = [];
    readonly config: IPlayerConfig;
    readonly storage: IStorageConfig;
    readonly resolve: ResolveService;
    readonly container: HTMLElement;
    readonly bVideo: any;
    dolbyEffect = false;

    session = md5(String((getCookie('buvid3') || Math.floor(Math.random() * 100000).toString(16)) + Date.now()));

    constructor(input: any, bVideo?: any) {
        // use config api
        try {
            Object.assign(HOSTCONFIG, JSON.parse(decodeURIComponent(input.hostConfig)));
        } catch (e) {}
        try {
            document.cookie = 'CURRENT_QUALITY=112;Max-Age=-1;path=/;';
        } catch (e) {}

        coreStyle.use();
        try {
            this.ucl = window.parent && window.parent.document ? window.parent : window;
        } catch (e) {
            this.ucl = window;
        }
        this.bVideo = bVideo;
        this.config = new OptionsService(input);
        this.storage = new StorageService();
        this.resolve = new ResolveService(this);
        this.container = this.config.element;
        this.init();
    }

    // 未登录用户自动观看清晰度qt（对照组-480p/32，实验组-720p/74）
    get noLoginAutoQualityQt() {
        return window['webAbTest']?.unregister_is_720p === '1' ? Quality.gtNeedLoginABTest : Quality.gtNeedLogin;
    }

    // fnval取值判断
    getFnval() {
        if (this.state.allowFlv) {
            if (this.config.dashSymbol) {
                if (this.config.inner) {
                    return FNVAL_TYPE.DASH_H265;
                } else {
                    return (
                        FNVAL_TYPE.DASH_8K +
                        FNVAL_TYPE.DOLBYVIDEO +
                        FNVAL_TYPE.DOLBYAUDIO +
                        FNVAL_TYPE.DASH_4K +
                        FNVAL_TYPE.HDR +
                        FNVAL_TYPE.DASH_H265
                    );
                }
            } else {
                return FNVAL_TYPE.FLV;
            }
        }
        return FNVAL_TYPE.MP4;
    }

    private init() {
        this.attachFrameView();
        this.detectAllowFlv();
        this.getVideoData();
        if (!performance.timing.perfPDTPEnd) {
            performance.timing.perfPDTPEnd = Date.now();
        }
        this.defer
            .then(() => {
                typeof window.PlayerMediaLoaded === 'function' &&
                    window.PlayerMediaLoaded({
                        aid: this.config.aid,
                        cid: this.config.cid,
                        bvid: this.config.bvid,
                    });
            })
            .catch(noop);
    }

    private attachFrameView() {
        const beforeChildNodes: ChildNode[] = [];
        const isPrerender = this.container.getAttribute('data-prerender') === 'true';
        if (this.config.activityKey) {
            this.container.style.setProperty('box-shadow', 'none');
        }
        this.container.classList.add(this.prefix);
        if (this.config.lightWeight) {
            this.container.classList.add(`${this.prefix}-light-weight`);
        }
        let clasName = '';
        switch (this.config.type) {
            case ContentType.OgvPre:
                clasName = '-ogv-preview';
                break;
            case ContentType.PugvCenter:
                clasName = '-pugv-center';
                break;
            default:
                break;
        }
        clasName && this.container.classList.add(this.prefix + clasName);

        if (this.config.pageVersion !== 0) {
            this.container.classList.add(`${this.prefix}-area-v${this.config.pageVersion}`);
        }

        this.jnode.videoWrap = this.container.querySelector<HTMLElement>(`.${this.prefix}-video-wrap`);
        if (!isPrerender) {
            for (let i = 0; i < this.container.childNodes.length; i++)
                beforeChildNodes.push(this.container.childNodes[i]);
            this.container.insertAdjacentHTML('beforeend', frameView(this.prefix));
            if (!performance.timing.perfPFCPEnd) {
                performance.timing.perfPFCPEnd = Date.now();
            }
            if (!performance.timing.perfBackdrop) {
                performance.timing.perfBackdrop = performance.now();
            }
            for (let i = 0; i < this.container.childNodes.length; i++) {
                if (!beforeChildNodes.some((childNode) => childNode === this.container.childNodes[i])) {
                    this.frameChildNodes.push(this.container.childNodes[i]);
                }
            }
        } else {
            const videoTop = `<div class="${this.prefix}-video-top-core">
                                <div class="${this.prefix}-video-top-issue" data-text="反馈"  aria-label="反馈" data-position="bottom-center">
                                    <span class="${this.prefix}-video-top-issue-icon">${feedback}</span>
                                    <span class="${this.prefix}-video-top-issue-text">一键反馈</span>
                                </div>
                            </div>`;
            this.jnode.videoWrap.append(videoTop);
        }
        this.jnode.area = this.container.querySelector<HTMLElement>(`.${this.prefix}-area`);
        if (+getCookie('blackside_state') && typeof window.PlayerAgent?.toggleBlackSide === 'function') {
            this.jnode.area.classList.add('video-state-blackside');
            if (this.config.asWide) {
                this.container.classList.add('mode-widescreen');
            }
        }
        this.jnode.videoWrap = this.container.querySelector<HTMLElement>(`.${this.prefix}-video-wrap`);
        this.jnode.loadingPanel = this.container.querySelector<HTMLElement>(`.${this.prefix}-video-panel`);
        this.jnode.loadingPanelDetail = this.container.querySelector<HTMLElement>(
            `.${this.prefix}-video-panel-blur-detail`,
        );
        this.jnode.loadingPanelText = this.container.querySelector<HTMLElement>(`.${this.prefix}-video-panel-text`);
        setTimeout(() => {
            this.jnode.loadingPanelDetail.style.display = 'block';
            this.jnode.loadingPanelText.style.display = 'block';
        }, 1500);
        this.microMessengerLoadPoster();
        const videoEle = this.container.querySelector(`.${this.prefix}-video`);
        if (
            window.parent &&
            window.parent !== window &&
            this.config.poster &&
            window['__INITIAL_STATE__']?.videoData?.pic
        ) {
            videoEle &&
                videoEle.insertAdjacentHTML(
                    'beforeend',
                    `<div class="${this.prefix}-video-poster"><img src="${thumbnail(
                        window['__INITIAL_STATE__']?.videoData?.pic.replace(/https?:\/\//, '//'),
                        this.jnode.videoWrap.clientWidth,
                    )}"></div>`,
                );
        }
        this.jnode.poster = this.container.querySelector<HTMLElement>(`.${this.prefix}-video-poster`);
        this.jnode.issue = this.container.querySelector<HTMLElement>(
            `.${this.prefix}-video-top-core .${this.prefix}-video-top-issue`,
        );
        this.jnode.issue?.addEventListener('click', (e) => {
            e.stopPropagation();
            window.GrayManager.getFeedback();
        });
    }

    private microMessengerLoadPoster() {
        if (Browser.microMessenger.alike) {
            const data: any = {};
            if (window['show_bv']) {
                data.bvid = this.config.bvid;
            } else {
                data.aid = this.config.aid;
            }
            axios({
                method: 'get',
                url: '//pre-api.bilibili.com/x/web-interface/view',
                responseType: 'json',
                params: data,
                withCredentials: true,
            })
                .then((response) => {
                    if (response && response.data) {
                        const { pic } = response.data.data;
                        if (pic) {
                            const url = thumbnail(pic.replace(/https?:\/\//, '//'), this.container.clientWidth);
                            this.container.insertAdjacentHTML(
                                'beforeend',
                                `<div class="${this.prefix}-load-poster" style="background-image:url('${url}')"><i class="${this.prefix}-play-icon"></i></div>`,
                            );
                            this.jnode.loadPoster = this.container.querySelector<HTMLElement>(
                                `.${this.prefix}-load-poster`,
                            );
                            if (this.jnode.loadPoster) {
                                this.jnode.loadPoster.addEventListener('click', this.onVideoWrapClick);
                            }
                        }
                    }
                })
                .catch((error) => {});
        }
    }

    private detectAllowFlv() {
        if (Browser.safari.alike && !Browser.safari.mseSupported) {
            this.state.allowFlv = false;
        } else {
            this.state.allowFlv = FlvPlugin.isSupported();
        }
    }

    private visibilityChangeEvent(remove?: boolean) {
        const prop = getHiddenProp();
        if (prop) {
            if (remove) {
                document.removeEventListener(`${prop.prefix}visibilitychange`, this.onVisibilityChange);
            } else {
                this.hiddenStartTime = Date.now();
                document.addEventListener(`${prop.prefix}visibilitychange`, this.onVisibilityChange);
            }
        }
    }

    private getVideoData(defaultQuality?: number, vtype?: string) {
        if (!defaultQuality) {
            const isLogin = Boolean(getCookie('DedeUserID'));
            const cQuality = getCookie('CURRENT_QUALITY');

            defaultQuality = this.storage.quality;

            if (cQuality != null && +cQuality !== defaultQuality) {
                setCookie('CURRENT_QUALITY', defaultQuality.toString());
            }
            if (this.config.quality) {
                defaultQuality = this.config.quality;
            }

            if (defaultQuality > Quality.gtNeedFlvSupported && !this.state.allowFlv) {
                defaultQuality = Quality.gtNeedFlvSupported;
            }

            if (!isLogin && defaultQuality > this.noLoginAutoQualityQt) {
                defaultQuality = defQuality;
            }
        }

        if (!vtype) {
            vtype = this.state.allowFlv ? '' : 'mp4';
        }

        this.state.defQuality = defaultQuality;
        const isPugv = this.config.type === ContentType.Pugv || this.config.type === ContentType.PugvCenter;
        const resolveParams: IResolveParams = {
            aid: this.config.aid,
            cid: this.config.cid,
            bvid: this.config.bvid,
            seasonId: this.config.seasonType,
            episodeId: this.config.episodeId,
            playerType: this.config.playerType,
            seasonType: this.config.seasonType,
            type: vtype,
            quality: defaultQuality,
            enableSSLResolve: this.config.enableSSLResolve,
            enableSSLStream: this.config.enableSSLStream,
            extraParams: this.config.extraParams,
            session: this.session,
            inner: this.config.inner,
            pugv: isPugv,
            upPreview: this.config.upPreview,
        };
        if (this.config.bvid) {
            resolveParams.bvid = this.config.bvid;
        } else {
            resolveParams.aid = this.config.aid;
        }
        const obj: object = qs.parse(resolveParams.extraParams);

        obj['qn'] = resolveParams.quality;

        const fnval = this.getFnval();
        resolveParams.fnver = obj['fnver'] = 0;
        resolveParams.fnval = obj['fnval'] = fnval;
        if (this.config.seasonType) {
            obj['season_type'] = this.config.seasonType;
        }
        if (this.ucl['typeid']) {
            obj['tid'] = this.ucl['typeid'];
        }

        this.rts.playurl_start = Date.now();
        this.eventQueues.push({
            type: 'video_playurl_load',
            timestamp: Date.now(),
        });

        // true initial time when player start load to player ready to request playurl
        if (this.bVideo) {
            this.bVideo.initCB();
        } else {
            if (this.ucl && this.ucl['GrayManager'] && this.ucl['GrayManager']['initialCallback']) {
                this.ucl['GrayManager']['initialCallback']('html5');
            }
        }

        resolveParams.extraParams = qs.stringify(obj);

        this.resolve.r(
            resolveParams,
            (result) => {
                if (result !== undefined && result.mediaDataSource !== null) {
                    this.state.errorPlayurl = false;
                    this.rts.playurl_end = Date.now();
                    this.eventQueues.push({
                        type: 'video_playurl_loaded',
                        timestamp: Date.now(),
                    });
                    let seekType = 'range';
                    if (result.mediaDataSource.type === 'flv') {
                        const segments = result.mediaDataSource.segments;
                        if (segments) {
                            for (let i = 0; i < segments.length; i++) {
                                const url = segments[i].url;
                                if (url && url.match(/\/ws\.acgvideo\.com\//)) {
                                    // ws.acgvideo.com: Use param seek (bstart/bend)
                                    seekType = 'param';
                                    break;
                                }
                            }
                        }
                    }
                    this.load({
                        mediaDataSource: result.mediaDataSource,
                        quality: result.quality,
                        seekType: seekType,
                    });
                } else {
                    this.state.errorPlayurl = true;
                    this.reportQueues.push({
                        type: 'video_media_error',
                        timestamp: Date.now(),
                        value: 4,
                    });
                    this.defer.reject(this);
                }
            },
            (code, error, playurl) => {
                this.state.errorPlayurl = true;
                this.reportQueues.push({
                    type: 'video_media_error',
                    timestamp: Date.now(),
                    value: 4,
                });
                this.defer.reject(this);
            },
        );
    }

    private load(data: IMediaDataForLoad) {
        this.rts.loadmetadata_start = Date.now();
        this.eventQueues.push({
            type: 'video_media_load',
            timestamp: Date.now(),
        });

        if (data.mediaDataSource.type === 'dash') {
            this.sharedPlayer = new DashPlayer(this, data);
        } else {
            this.sharedPlayer = new FlvPlayer(this, data);
        }
        this.config.muted && (this.sharedPlayer.video.muted = true);
        const videoEle = this.container.querySelector(`.${this.prefix}-video`);
        videoEle && videoEle.appendChild(this.sharedPlayer.video);
        this.addVideoListeners();
        this.visibilityChangeEvent();
    }
    private addVideoListeners() {
        if (this.sharedPlayer) {
            this.sharedPlayer.video.addEventListener('play', this.onMediaPlay);
            this.sharedPlayer.video.addEventListener('pause', this.onMediaPause);
            this.sharedPlayer.video.addEventListener('canplay', this.onMediaCanPlay);
            this.sharedPlayer.video.addEventListener('loadedmetadata', this.onMediaLoadedMetadata);
            this.sharedPlayer.video.addEventListener('error', this.onMediaError);
        }
        if (this.jnode.videoWrap) {
            this.jnode.videoWrap.addEventListener('click', this.onVideoWrapClick);
        }
    }

    @bind
    private onMediaPlay() {
        if (performance?.timing && !performance.timing.playerStage4) {
            performance.timing.playerStage4 = +new Date();
        }
        this.jnode.poster && (this.jnode.poster.style.display = 'none');
        this.stopBufferingChecker();
        this.dirtyBufferingChecker();
        if (this.sharedPlayer) {
            if (!this.sharedPlayer.video.seeking && this.jnode.area) {
                this.jnode.area.classList.remove('video-state-pause');
            }
        }
    }

    @bind
    private onMediaPause() {
        this.stopBufferingChecker();
        if (this.sharedPlayer) {
            if (!this.sharedPlayer.video.seeking && this.jnode.area) {
                this.jnode.area.classList.add('video-state-pause');
            }
        }
    }

    @bind
    private onMediaCanPlay() {
        if (this.sharedPlayer) {
            this.sharedPlayer.video.removeEventListener('canplay', this.onMediaCanPlay);
            this.reportQueues.push({
                type: 'canplay_speed',
                value: this.sharedPlayer.averageThroughput.toFixed(3),
                timestamp: Date.now(),
            });
        }
        if (this.jnode.loadingPanel) {
            this.jnode.loadingPanel.style.display = 'none';
        }
        this.eventQueues.push({
            type: 'video_media_canplay',
            timestamp: Date.now(),
        });
        this.bVideo?.emit(EventType.canplay);
        this.defer.resolve(this);
    }

    @bind
    private onMediaLoadedMetadata() {
        this.rts.loadmetadata_end = Date.now();
        this.eventQueues.push({
            type: 'video_media_loaded',
            timestamp: Date.now(),
        });
        // send loaded_time (but real loaded_time should be set in canplay event)
        if (this.bVideo) {
            this.bVideo.loadedCB();
        } else {
            if (this.ucl && this.ucl['GrayManager'] && this.ucl['GrayManager']['loadedCallback']) {
                this.ucl['GrayManager']['loadedCallback']('html5');
            }
        }
        if (Browser.microMessenger.alike) {
            this.defer.resolve(this);
        }
    }

    @bind
    private onMediaEneded() {
        clearInterval(this.bufferingTimer);
    }

    @bind
    private onMediaError(e: any) {
        if (VideoElementUtils.isEnabledBwpHEVC(this.sharedPlayer.video)) {
            VideoElementUtils.disableBwpHEVC();
            this.eventQueues.push({
                type: 'wasm_player_error',
                timestamp: Date.now(),
                params: [e.errorCode || 7000, e?.describe],
            });
        }
        this.defer.reject(this);
    }

    @bind
    private onVideoWrapClick() {
        if (this.sharedPlayer) {
            this.jnode.loadPoster && this.jnode.loadPoster.remove();
            if (this.sharedPlayer.video.paused) {
                this.sharedPlayer.video.play();
            } else {
                this.sharedPlayer.video.pause();
            }
        }
    }

    @bind
    private onVisibilityChange() {
        if (!isDocumentHidden()) {
            this.state.fixTime = Date.now() - this.hiddenStartTime;
        }
    }

    private dirtyBufferingChecker() {
        this.bufferingTimer = window.setInterval(() => {
            if (this.sharedPlayer) {
                const isBuffering = this.state.lastVideoTime === this.sharedPlayer.video.currentTime;
                if (this.state.isBuffering !== isBuffering) {
                    this.state.isBuffering = isBuffering;
                    if (this.jnode.area) {
                        if (this.state.isBuffering) {
                            this.jnode.area.classList.add('video-state-buff');
                        } else {
                            this.jnode.area.classList.remove('video-state-buff');
                        }
                    }
                }
                if (!isBuffering) {
                    this.state.lastVideoTime = this.sharedPlayer.video.currentTime;
                }
            }
        }, 150);
    }

    private stopBufferingChecker() {
        clearInterval(this.bufferingTimer);
        if (this.jnode.area) {
            this.jnode.area.classList.remove('video-state-buff');
        }
    }

    get loadedmetadata() {
        return this.defer;
    }

    delivery() {
        if (!this.state.errorPlayurl && this.sharedPlayer) {
            return {
                session: this.session,
                typedInfo: this.sharedPlayer.typedInfo,
                defQuality: this.state.defQuality,
                eventQueues: this.eventQueues,
                reportQueues: this.reportQueues,
                playurlStartTime: this.rts.playurl_start,
                partialReceivedBytes: this.sharedPlayer.currentReceivedBytes,
                partialReceivedVideoIndex: this.sharedPlayer.currentReceivedVideoIndex,
                partialReceivedAudioIndex: this.sharedPlayer.currentReceivedAudioIndex,
                elapsed: {
                    playurl: this.rts.playurl_end - this.rts.playurl_start,
                    loadmetadata: this.rts.loadmetadata_end - this.rts.loadmetadata_start - this.state.fixTime,
                },
                clearInteraction: this.clearInteraction.bind(this),
            };
        } else {
            return null;
        }
    }

    private clearInteraction() {
        this.stopBufferingChecker();
        this.resolve.destroy();
        if (this.sharedPlayer) {
            this.sharedPlayer.clearInteraction();
            this.sharedPlayer.video.removeEventListener('play', this.onMediaPlay);
            this.sharedPlayer.video.removeEventListener('pause', this.onMediaPause);
            this.sharedPlayer.video.removeEventListener('canplay', this.onMediaCanPlay);
            this.sharedPlayer.video.removeEventListener('loadedmetadata', this.onMediaLoadedMetadata);
            this.sharedPlayer.video.removeEventListener('error', this.onMediaError);
        }
        if (this.jnode.videoWrap) {
            this.jnode.videoWrap.removeEventListener('click', this.onVideoWrapClick);
        }
        if (this.jnode.loadPoster) {
            this.jnode.loadPoster.removeEventListener('click', this.onVideoWrapClick);
        }
        this.visibilityChangeEvent(true);
        coreStyle.unuse();
    }

    destroy() {
        this.clearInteraction();
        if (this.sharedPlayer) {
            this.sharedPlayer.destroy();

            VideoElementUtils.destroyVideoElement(this.sharedPlayer.video);
        }
        this.frameChildNodes.forEach((childNode) => {
            if (childNode.parentNode) {
                childNode.parentNode.removeChild(childNode);
            }
        });
        this.jnode.loadPoster && this.jnode.loadPoster.remove();
    }
}
