import { noop, bufferFromBase64 } from '../utils/general';
import { Browser } from '../utils/browser';
import { Quality } from '../utils/quality';
import { CorePlayer } from '../core-player';
import axios, { CancelTokenSource } from 'axios';
import { IPreloadAVData } from '../player/base-player';
import DashPlugin from '@jsc/dash-player';

interface IAVStreamSegment {
    id?: number;
    baseUrl?: string;
    codecid?: number;
    codecs?: string;
    backupUrl?: string[];
}

export interface IMPDJsonData {
    video: IAVStreamSegment[];
    audio: IAVStreamSegment[];
    duration: number;
    dolby?: {
        type?: number;
        audio?: IAVStreamSegment[];
    };
}

interface IMediaDataSegment {
    url?: string;
    length?: number;
    duration?: number;
    filesize?: number;
    backupURL?: string[];
}

export interface IMediaDataSource {
    url?: string | IMPDJsonData;
    type?: string;
    filesize?: number;
    duration?: number;
    backupURL?: string[];
    segments?: IMediaDataSegment[];
    prebuffer?: ArrayBuffer; // FLV only
    preloadAVData?: IPreloadAVData;
}

interface IPlayurlBodyParsed {
    streamType: string;
    mediaDataSource: IMediaDataSource;
    acceptFormat: string;
    acceptQuality: number[];
    acceptDescription: string[];
    timelength: number;
    quality: number;
    format: string;
    videoFrame?: IPreloadAVData;
}

interface ICallbackTable {
    params: IResolveParams;
    resolve: (result?: IPlayurlBodyParsed) => void;
    reject: (code: ErrorTypes, msg: string, playurl?: string) => void;
}

export interface IResolveParams {
    aid: number;
    cid: number;
    bvid: string;
    type: string;
    quality: number;
    playerType: number;
    seasonType: number;
    enableSSLResolve: boolean;
    enableSSLStream: boolean;
    extraParams: string;
    seasonId?: number;
    episodeId?: number;
    fnver?: number;
    fnval?: number;
    session?: string;
    inner?: boolean;
    pugv?: boolean;
    upPreview?: boolean;
}
export const HOSTCONFIG = {
    api: 'pre-api.bilibili.com',
    passport: 'passparpre-t.bilibili.com',
};
export class BusinessPlayurls {
    static get ugc() {
        return `${HOSTCONFIG.api}/x/player/playurl`;
    }
    static get pgc() {
        return `${HOSTCONFIG.api}/pgc/player/web/playurl`;
    }
    static get pugv() {
        return `${HOSTCONFIG.api}/pugv/player/web/playurl`;
    }
    static inner: any = 'pre-manager.bilibili.co/v2/playurl';
    static up: any = 'pre-member.bilibili.com/x/web/archive/video/playurl';
}

export const enum ErrorTypes {
    network = 0,
    resolve = 1,
}

export class ResolveService {
    private cancelTokenSource: CancelTokenSource;

    constructor(private readonly player: CorePlayer) {
        const CancelToken = axios.CancelToken;
        this.cancelTokenSource = CancelToken.source();
    }

    r(params: IResolveParams, resolve: ICallbackTable['resolve'], reject: ICallbackTable['reject']) {
        let args = { params, resolve, reject };
        let retrycount = 3;
        let playinfo = this.player.ccl['__playinfo__'];
        let playinfodata: IPlayurlBodyParsed | void;

        if (playinfo && typeof playinfo === 'object') {
            delete this.player.ccl['__playinfo__'];

            if (playinfo['videoFrame'] && playinfo['data']) {
                playinfo['data']['videoFrame'] = playinfo['videoFrame'];
            }

            if (playinfo['session']) {
                // 透传 session
                this.player.session = playinfo['session'];
                params.session = playinfo['session'];
            }

            if (typeof playinfo['data'] === 'object') {
                // 兼容业务 playurl
                playinfo = playinfo['data'];
            }

            let valid: boolean;

            if (this.player.state.allowFlv) {
                valid = playinfo['format'] && playinfo['format'].indexOf('mp4') === -1;
            } else {
                valid = playinfo['format'] && playinfo['format'].indexOf('mp4') > -1;
            }

            if (valid) {
                playinfodata = this.parse(playinfo, {
                    params: args.params,
                    resolve: args.resolve,
                    reject: noop,
                });
            }
        }

        if (playinfodata) {
            this.urlChecker(playinfodata, (res) => args.resolve(res));
        } else {
            this.handlePlayurlRequest(params, args, retrycount);
        }
    }

    private handlePlayurlRequest(
        params: IResolveParams,
        args: ICallbackTable,
        retrycount: number,
        forceHttp?: boolean,
    ) {
        const businessPlayurl = params.pugv
            ? BusinessPlayurls.pugv
            : params.inner
            ? BusinessPlayurls.inner
            : params.upPreview
            ? BusinessPlayurls.up
            : params.seasonType >= 1
            ? BusinessPlayurls.pgc
            : BusinessPlayurls.ugc;
        const url = forceHttp ? `http://${businessPlayurl}` : `//${businessPlayurl}`;
        const data = {
            cid: params.cid,
            qn: params.quality,
            type: params.type,
            otype: 'json',
            fourk: 1,
        };
        if (params.bvid) {
            data['bvid'] = params.bvid;
        } else {
            data['avid'] = params.aid;
        }
        if (params.episodeId) {
            data['ep_id'] = params.episodeId;
        }
        if (typeof params.fnver === 'number') {
            data['fnver'] = params.fnver;
            data['fnval'] = params.fnval;
            data['session'] = params.session;
        }
        const startTime = Date.now();
        axios({
            method: 'get',
            url: url,
            responseType: 'json',
            params: data,
            withCredentials: true,
            cancelToken: this.cancelTokenSource.token,
        })
            .then((response) => {
                this.player.reportQueues.push({
                    type: 'api_playurl_done_time',
                    value: Date.now() - startTime,
                    timestamp: Date.now(),
                });
                const result = this.parse(response.data, args, url);
                if (typeof result !== 'undefined') {
                    this.urlChecker(result, (res) => args.resolve(res));
                }
            })
            .catch((error) => {
                this.player.reportQueues.push({
                    type: 'api_playurl_fail_time',
                    value: Date.now() - startTime,
                    timestamp: Date.now(),
                });
                const https = /^https:/.test(url) || /^\/\//.test(url);
                if (https) {
                    if (retrycount) {
                        return this.handlePlayurlRequest(params, args, --retrycount, forceHttp);
                    } else {
                        return this.handlePlayurlRequest(params, args, retrycount, true);
                    }
                }
                args.reject(
                    ErrorTypes.network,
                    (error.response && error.response.status && error.response.status.toString()) || '',
                    url,
                );
            });
    }

    private urlChecker<T extends IPlayurlBodyParsed>(result: T, callback: (res: T) => void) {
        const url =
            result.mediaDataSource &&
            result.mediaDataSource.segments &&
            result.mediaDataSource.segments[0] &&
            result.mediaDataSource.segments[0].url;

        if (result.videoFrame && result.mediaDataSource) {
            result.mediaDataSource.preloadAVData = result.videoFrame;
            if (
                result.quality === Number(result.videoFrame.qn) &&
                result.videoFrame.type === result.mediaDataSource.type &&
                result.videoFrame.type === 'flv' &&
                result.videoFrame.video
            ) {
                result.mediaDataSource.prebuffer = bufferFromBase64(result.videoFrame.video);
            }
        }

        if (result.mediaDataSource.type === 'dash') {
            callback(result);
        } else if (
            result.mediaDataSource.type === 'mp4' &&
            result.mediaDataSource.url &&
            (<string>result.mediaDataSource.url).match(/:\/\/ws\.acgvideo\.com\//)
        ) {
            axios({
                method: 'get',
                url: result.mediaDataSource['url'] + '&get_url=1',
                responseType: 'text',
                cancelToken: this.cancelTokenSource.token,
            })
                .then((response) => {
                    result.mediaDataSource.url = response.data;
                    callback(result);
                })
                .catch(() => {
                    callback(result);
                });
        } else if (
            (Browser.safari.alike || Browser.trident.alike || Browser.edge.alike) &&
            result.mediaDataSource.type === 'flv' &&
            url &&
            url.match(/:\/\/ws\.acgvideo\.com\//)
        ) {
            axios({
                method: 'get',
                url: url + '&get_url=1',
                responseType: 'text',
                cancelToken: this.cancelTokenSource.token,
            })
                .then((response) => {
                    const realhosts = /\/\/(.*)?\/ws\.acgvideo\.com/.exec(response.data);
                    if (realhosts) {
                        const realhost = realhosts[1];
                        if (result.mediaDataSource.segments) {
                            for (let i = 0; i < result.mediaDataSource.segments.length; i++) {
                                const segment = result.mediaDataSource.segments[i];
                                if (segment && segment.url) {
                                    result.mediaDataSource.segments[i].url = segment.url.replace(
                                        /\/\/ws\.acgvideo\.com/,
                                        '//' + realhost + '/ws.acgvideo.com',
                                    );
                                }
                            }
                        }
                    }
                    callback(result);
                })
                .catch(() => {
                    callback(result);
                });
        } else {
            callback(result);
        }
    }

    private parse<U>(body: U, args: ICallbackTable, playurl?: string): IPlayurlBodyParsed | void {
        if (!body) {
            args.reject(ErrorTypes.resolve, 'Invalid response data', playurl);
            return;
        }

        const mediaDataSource: IMediaDataSource = {};
        const data = body['data']
            ? body['data']
            : Object.prototype.toString.call(body['result']) === '[object Object]'
            ? body['result']
            : body; // 接口向后兼容
        // const data = body[args.params.seasonType >= 1 ? 'result' : 'data'] || body; // 接口向后兼容

        if (body['data'] && body['code'] !== 0) {
            const str = body['code'] + ': ' + body['message'];
            args.reject(ErrorTypes.resolve, str, playurl);
            return;
        }

        if (!data['result']) {
            if (
                typeof data['durl'] !== 'undefined' ||
                typeof data['dash_mpd'] !== 'undefined' ||
                typeof data['dash'] !== 'undefined'
            ) {
                // add dash mpd support
                data['result'] = 'suee';
            } else {
                let str = 'Error';
                if (data['error_text']) {
                    str = data['error_code'] + ': ' + data['error_text'];
                }
                args.reject(ErrorTypes.resolve, str, playurl);
                return;
            }
        }

        if (data['result'] !== 'suee') {
            if (data['result'] === 'error') {
                args.reject(ErrorTypes.resolve, 'Resolve Error: ' + data['message'], playurl);
            } else {
                args.reject(ErrorTypes.resolve, 'Resolve Error: result is ' + data['result'], playurl);
            }
            return;
        }

        if (data['from'] !== 'local' || data['result'] !== 'suee') {
            args.reject(ErrorTypes.resolve, 'Unsupported video source: ' + data['from'], playurl);
            return;
        }

        let acceptFormat = data['accept_format'];
        let acceptQuality = data['accept_quality'];
        let acceptDescription = data['accept_description'];
        let format = data['format'];
        let videoFrame = data['videoFrame'];
        let supportFormats = data['support_formats'];

        if (!acceptFormat || acceptFormat.length === 0) {
            acceptFormat = [data['format']];
        }
        if (!acceptQuality || acceptQuality.length === 0) {
            acceptQuality = [2];
        }

        let type = 'flv';
        if (data['format'] && data['format'].indexOf('mp4') > -1) {
            type = 'mp4';
        }
        if (data['dash_mpd'] || data['dash']) {
            type = 'dash';
        }
        if (type !== 'dash' && (!Array.isArray(data['durl']) || data['durl'].length === 0)) {
            args.reject(ErrorTypes.resolve, 'Invalid durl', playurl);
            return;
        }

        const timelength = data['timelength'];
        let quality = data['quality'];

        mediaDataSource.type = type;
        mediaDataSource.duration = 0;

        let streamType = 'http';

        if (type === 'dash') {
            mediaDataSource.duration = data['timelength'] || 0;
            mediaDataSource.url = data['dash_mpd'] || data['dash'];
            if (args.params.enableSSLStream && mediaDataSource.url) {
                streamType = 'https';
                if (typeof mediaDataSource.url === 'string') {
                    mediaDataSource.url = mediaDataSource.url.replace(/http:\/\//g, 'https://');
                } else {
                    const mpd = <IMPDJsonData>mediaDataSource.url;
                    if (mediaDataSource.url && mediaDataSource.url.duration) {
                        mediaDataSource.url.duration = mediaDataSource.url.duration - 1;
                    }
                    mediaDataSource.duration =
                        mediaDataSource.url && mediaDataSource.url.duration > 0
                            ? mediaDataSource.url.duration * 1000
                            : data['timelength'] || 0;
                    const replaceUrlProtocol = (segments: IAVStreamSegment[]) => {
                        return (
                            segments &&
                            segments.map &&
                            segments.map((segment: IAVStreamSegment) => {
                                if (segment['base_url']) {
                                    segment.baseUrl = segment['base_url'].replace(/http:\/\//g, 'https://');
                                }
                                if (Array.isArray(segment['backup_url'])) {
                                    segment.backupUrl = segment['backup_url'].map((url: string) => {
                                        return url.replace(/http:\/\//g, 'https://');
                                    });
                                }
                                return segment;
                            })
                        );
                    };
                    mediaDataSource.url.video = replaceUrlProtocol(mpd.video);
                    mediaDataSource.url.audio = replaceUrlProtocol(mpd.audio);

                    /**
                     * 杜比类型判断
                     */
                    if (mediaDataSource['url']['dolby'] && mediaDataSource['url']['dolby']['type']) {
                        // type 0-无；1-普通杜比音效；2-杜比全景声
                        if (DashPlugin['isBwpHEVCPrefSupported']?.()) {
                            this.player.dolbyEffect = !!+mediaDataSource['url']['dolby']['type'];
                        } else {
                            this.player.dolbyEffect = false;
                        }
                    } else {
                        this.player.dolbyEffect = false;
                    }

                    // Firefox 不支持 4K 120
                    if (quality === 120 && Browser.gecko.alike) {
                        for (let i = 0; i < (<IMPDJsonData>mediaDataSource.url).video.length; i++) {
                            const d = (<IMPDJsonData>mediaDataSource.url).video[i];
                            if (quality === d.id && d.codecid === 7) {
                                const testVideo = document.createElement('video');
                                if (
                                    !(
                                        testVideo &&
                                        testVideo.canPlayType &&
                                        testVideo.canPlayType(`video/mp4; codecs="${d.codecs}, mp4a.40.2"`)
                                    )
                                ) {
                                    acceptDescription.splice(0, 1);
                                    acceptQuality.splice(0, 1);
                                    quality = acceptQuality[0];
                                    data.quality = acceptQuality[0];
                                }
                                break;
                            }
                        }
                    }
                }
            }
            if (args.params.enableSSLStream) {
                streamType = 'https';
            }
        } else if (type === 'mp4') {
            // singlepart mp4
            const durl = data['durl']![0];
            const backupURL: string[] = [];
            let url = durl['url'];
            if (args.params.enableSSLStream && url) {
                streamType = 'https';
                url = url.replace('http://', 'https://');
            }
            durl['backup_url'] &&
                durl['backup_url'].forEach((item: string) => {
                    if (args.params.enableSSLStream && item) {
                        streamType = 'https';
                        item = item.replace('http://', 'https://');
                    }
                    backupURL.push(item);
                });
            mediaDataSource.url = url;
            mediaDataSource.backupURL = backupURL;
            mediaDataSource.duration = durl['length'];
        } else {
            // multipart flv
            mediaDataSource.segments = [];
            mediaDataSource.duration = 0;
            data['durl']!.forEach((durl: any) => {
                let url = durl['url'];
                const backupURL: string[] = [];
                if (args.params.enableSSLStream && url) {
                    streamType = 'https';
                    url = url.replace('http://', 'https://');
                }
                durl['backup_url'] &&
                    durl['backup_url'].forEach((item: string) => {
                        if (args.params.enableSSLStream && item) {
                            streamType = 'https';
                            item = item.replace('http://', 'https://');
                        }
                        backupURL.push(item);
                    });
                const segment: IMediaDataSegment = {};
                segment.duration = durl['length'];
                segment.filesize = durl['size'];
                segment.url = url;
                segment.backupURL = backupURL;
                mediaDataSource.duration += durl['length'];
                if (mediaDataSource.segments) {
                    mediaDataSource.segments.push(segment);
                }
            });
        }

        /**
         * @desc Always write raw body to Current Context Layer before **SUCCESSFUL** parsed.
         */
        this.player.ccl['__playinfo__'] = body;

        return this.normalize({
            streamType: streamType,
            mediaDataSource: mediaDataSource,
            acceptFormat: acceptFormat,
            acceptQuality: acceptQuality,
            acceptDescription: acceptDescription,
            supportFormats: supportFormats,
            timelength: timelength,
            quality: quality,
            format: format,
            videoFrame: videoFrame,
        });
    }

    private normalize<T extends IPlayurlBodyParsed>(result: T): T {
        if (result) {
            if (result.quality) {
                result.quality = Quality.normalize(result.quality);
            }
            if (Array.isArray(result.acceptQuality)) {
                result.acceptQuality = result.acceptQuality.map((q) => Quality.normalize(q));
            }
        }
        return result;
    }

    destroy() {
        this.cancelTokenSource.cancel();
    }
}
