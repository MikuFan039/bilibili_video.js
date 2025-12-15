import EventEmitter from 'events';
import { EventType } from '@jsc/namespace';

import analysis from '../plugins/analysis';
import { utils } from '@shared/utils';

import BPlayer, { IConfig } from '../player';
import PlayerSelector from './player-selector';

export default class BVideo extends EventEmitter {
    prefix: string;
    playerSelector: PlayerSelector;
    element: HTMLElement;

    private initialLoadedSend = false; // 播放器载入耗时发送标记
    private loadedTimeSend = false; // 首帧耗时发送标记
    private loadingTime = +new Date();
    private reloadTime: number;
    private hiddenStartTime = 0;
    private fixTime: number;
    private container: HTMLElement;

    constructor(public bplayer: BPlayer, public config: IConfig) {
        super();
        this.prefix = config.prefix;
        this.fixTime = 0;
        this.reloadTime = 0;

        // 给播放器lab用的，之后可以考虑更优的方案
        window.GrayManager = window.GrayManager || {};

        this.events(); // 设置监听事件
        this.init();
    }

    private init() {
        this.container = document.getElementById(`${this.config.parentId}`)!;
        this.container.innerHTML = `<div id="${this.config.parentId}Player"></div>`;
        this.element = document.getElementById(`${this.config.parentId}Player`)!;

        this.playerSelector = new PlayerSelector(this, this.config);
    }

    private events() {
        // 计算页面隐藏时间
        try {
            const visProp = utils.getHiddenProp();
            if (visProp) {
                const evtname = `${visProp.replace(/[H|h]idden/, '')}visibilitychange`;
                this.hiddenStartTime = +new Date();
                document.addEventListener(evtname, () => {
                    if (!utils.isDocumentHidden()) {
                        this.fixTime = +new Date() - this.hiddenStartTime!;
                    }
                });
            }
        } catch (e) {
            console.warn(e);
        }
    }

    emit(event: string | symbol, ...arg: any): boolean {
        // 触发外部绑定的监听事件
        this.bplayer.emit(event, ...arg);
        return super.emit(event, ...arg);
    }

    reload(config: IConfig) {
        this.config = config;
        this.reloadTime = +new Date();
        this.loadingTime = this.reloadTime;
        this.initialLoadedSend = false;
        analysis.resetInitialTime();
        this.init();
    }
    // ---------------------时间统计上报----------------------
    initCB() {
        const time = +new Date() - this.loadingTime;
        if (!this.initialLoadedSend) {
            this.initialLoadedSend = true;
            analysis.send(time, 'initial_time');
        }
        return time;
    }
    loadedCB() {
        const baktime = +new Date() - this.loadingTime - this.fixTime;
        let player = this.playerSelector.selector.player;
        let time = baktime;

        if (!this.loadedTimeSend) {
            this.loadedTimeSend = true;
            analysis.send(time, 'loaded_time', player);
            analysis.send(baktime, 'frame_time', player);
        } else if (this.reloadTime) {
            analysis.send(+new Date() - this.reloadTime, 'reload_time', player);
            this.reloadTime = 0;
        }
        return time;
    }
    // ---------------------end----------------------

    // 预加载playerurl
    preLoadUrl() {
        // this.playerSelector.selector.preLoadUrl();
    }
    // 反馈
    getFeedback(mini: boolean) {}
    // 网页全屏
    webFullscreen(status: boolean) {
        this.emit(EventType.fullwin, status);

        const parentWrap = document.getElementById(`${this.config.parentId}Player`)!;
        if (status) {
            parentWrap.classList.add(`${this.prefix}-webfullscreen`);
        } else {
            parentWrap.classList.remove(`${this.prefix}-webfullscreen`);
        }
    }
    // 宽屏
    wideScreen() {
        this.webFullscreen(false);
        this.emit(EventType.widewin);
    }
    // 切换播放器
    playerChange(isH5: boolean) {
        // 开灯
        // this.heimu(0, 0);
        // // 隐藏黑边
        // const toggleBlackSide = this.directiveManager.getPlayerAgentProp('toggleBlackSide');
        // typeof toggleBlackSide === 'function' && toggleBlackSide(false);
        // // 切换播放器
        // this.playerSelector.playerChange(isH5);
    }
    // 开关灯
    heimu(api: number, b: number) {
        // let heimuWrap: HTMLElement | null = document.querySelector(`.${this.prefix}-heimu`);
        // const player: HTMLElement = document.getElementById(BConfig.config.parentId)!;
        // if (!heimuWrap) {
        //     document.body.insertAdjacentHTML(
        //         'beforeend',
        //         `<div id="heimu" class="${this.prefix}-heimu"></div>`,
        //     );
        //     heimuWrap = document.querySelector(`.${this.prefix}-heimu`);
        // }
        // if (b === 0) {
        //     if (heimuWrap !== null) {
        //         heimuWrap.style.display = 'none';
        //         player?.classList.remove(`${this.prefix}-light`);
        //     }
        // } else {
        //     if (heimuWrap !== null) {
        //         player?.classList.add(`${this.prefix}-light`);
        //         heimuWrap.style.opacity = `.${api / 10}`;
        //         heimuWrap.style.filter = `alpha(opacity=${api})`;
        //         heimuWrap.style.display = 'block';
        //     }
        // }
    }
    // 主要为了右侧面板reload，获取传参的，之后可以考虑reload传参
    getParseConfig() {
        return this.config;
    }

    destroy() {
        this.playerSelector?.destroy();
    }
}
