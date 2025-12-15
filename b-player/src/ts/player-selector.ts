import BVideo from './b-video';

import analysis from '../plugins/analysis';
import H5Player from './h5player';
import { IConfig } from '../player';

export default class PlayerSelector {
    selector: H5Player;
    auxiliary: any;
    supportH5: boolean; // 是否支持HTML5播放器

    private startTimeSend?: boolean;

    constructor(public bVideo: BVideo, public config: IConfig) {
        this.supportH5 = !!this.checkH5();
        this.init();
    }

    private init() {
        // 当传入musth5参数时，不支持h5，直接返回
        if (this.noH5()) return;

        if (!this.startTimeSend) {
            this.startTimeSend = true;
            try {
                const timing = window.performance.timing;
                if (timing?.navigationStart) {
                    const time = +new Date() - timing.navigationStart;
                    analysis.send(time, 'start_time', this.selector.player);
                }
            } catch (e) {
                // console.warn(e);
            }
        }
        this.initH5();
    }
    reload(config: IConfig) {
        this.selector.destroy();
        this.selector.reload(config);
    }
    resize() {
        this.auxiliary?.resize();
    }
    // -------------------------------
    private initH5() {
        this.selector = new H5Player(this, this.config);
    }
    // ---------------------------------H5相关------------------------------------------
    // 是否支持H5播放器mse
    private checkH5() {
        const ua = navigator.userAgent;
        const checkCore = !(
            /msie [\w.]+/.exec(ua.toLowerCase()) ||
            (/Trident/i.test(ua) && /Windows NT 6/.test(ua)) ||
            !window.URL
        );
        if (checkCore) {
            const video = document.createElement('video');
            return video.canPlayType && video.canPlayType('video/mp4; codecs="avc1.42001E, mp4a.40.2"');
        }
        return checkCore;
    }
    // 强制使用H5播放器，但不能播放，提示。。。
    private noH5() {
        if (this.config.musth5 && !this.supportH5) {
            this.mustH5();
            return true;
        }
        return false;
    }

    private mustH5() {
        import(/* webpackChunkName: "musth5" */ '@jsc/must-h5').then((s) => {
            new s.default({
                id: this.config.parentId,
                url: '//pre-s1.hdslb.com/bfs/static/player/img/h5.png',
                textList: ['您当前的浏览器不支持HTML5播放器', '请切换浏览器再试试哦~'],
            });
        });
    }

    destroy() {
        this.selector.destroy();
    }
}
