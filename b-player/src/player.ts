import './less/index.less';

import '../polyfills';
import { ContentType, EventType } from '@jsc/namespace';
// namespace();

import { utils, extend } from '@shared/utils';
import EventEmitter from 'events';
import BVideo from './ts/b-video';
import { IPlayer } from './common/base-player';
// import { IReceived } from './plugins/directive-manager';
import RebuildCfg from './io/rebuild-cfg';

export interface IConfig {
    parentId: string;
    prefix: string; // class 前缀（播放器内部写死
    aid: number; //	视频aid
    bvid?: string;
    show_bv?: number;
    cid?: number; //  视频cid
    p?: number; //  视频第几p（当无cid、episodeId时必填
    musth5?: boolean; //  强制使用h5播放器
    autoplay?: boolean; //	(可选)自动播放
    as_wide?: boolean; //	(可选)默认宽屏
    lastplaytime?: number; //	(可选)上次播放时间
    last_ep_id?: boolean; //	(可选)上次播放epid
    player_type?: number; //	(可选)播放器模式 0 稿件 1 番剧 2 电影 不填的话按稿件处理，PGC将没有1080P
    season_type?: number; //	(PGC必填)bangumi类型
    enable_ssl_resolve?: boolean; // (可选)是否请求https的稿件接口
    enable_ssl_stream?: boolean; // (可选)是否请求https的稿件接口
    seasonId?: number; //	有season_type时必填 番剧标识
    episodeId?: number; //	有season_type时必填 番剧当前话标识
    crossDomain?: boolean; //	有season_type时必填 会去请求bangumi下的playurl
    isListSpread?: boolean; //	(可选)右侧列表默认是否默认展开
    canCollapse?: boolean; //	(可选)右侧列表是否允许收起，默认展开情况下生效
    theme?: string; //	(可选)播放器主题，默认：blue，可以选：green，red
    type?: number; //	(可选)视频类型，取   BPlayer.type
    hasDanmaku?: boolean; //	(可选) 是否有弹幕功能
    quality?: number; //  (可选, number类型) 默认视频清晰度（取值看文档
    noEndPanel?: boolean; //	(可选)是否显示结束面板（非空即为true，没结束面板）
    has_next?: boolean; //	(可选)是否有下一p（非空即为true，有下一p）
    listLoop?: boolean; //	(可选)是否列表循环播放（
    lightWeight?: boolean; //	(可选)是否轻量播放器
    attribute?: string; //	(可选)
    playlistId?: number; //	(可选)
    inner?: boolean; // (可选) 是否请求内网 playurl地址
    d?: number; //	(可选)弹幕日期（单位：s)
    t?: number; //	(可选)初始化视频跳转时间（单位：s)
    isIframe?: boolean; //	(可选)是否是iframe
    auxiliary?: boolean; //	(可选)是否右侧列表

    extra_params?: string; // 其他参数，例如：（ 'module=bangumi&qn=64'）

    // 以下 内部使用参数
    storageName?: string; // (可选)
    dashSymbol?: boolean; // 是否请求dash playurl地址
    gamePlayer?: boolean; // (可选)是否是游戏播放器
    flashGame?: string; //	(可选)只用于iframe 游戏播放器
    graphVersion?: number; // (可选) 互动视频版本号（非第一p
    touchMode?: boolean; // (可选) 是否触摸屏
    element?: HTMLElement; //

    danmaku?: boolean; //	(仅测试, 可选) 0 关闭弹幕 1 开启弹幕
    s_from?: number; //	(仅测试，可选)区间视频的开始时间
    s_to?: number; //	(仅测试，可选)区间视频的结束时间
}
// 改类下的所有方法  都是给外部用的（页面、flash
export default class BPlayer extends EventEmitter {
    // 全局静态属性
    static get metadata(): bPlayer.Metadata {
        // @ts-ignore from webpack.DefinePlugin
        return __X_METADATA__;
    }
    static get type(): bPlayer.ContentType {
        return ContentType;
    }
    static get events(): bPlayer.EventType {
        return EventType;
    }

    actionList: any[] = [['pause']];

    config: IConfig;
    bVideo: BVideo;
    player: IPlayer; // 对应真实播放器实例

    constructor(options: IConfig) {
        super();
        let cfg: any = utils.defaultSearch();
        RebuildCfg.parseCfg({
            prefix: 'b-player',
            parentId: 'bofqi',
            player_type: 0,
            ...options,
            ...cfg,
        }).then((config: IConfig) => {
            this.config = config;
            this.bVideo = new BVideo(this, config);
        });
    }
    // ---------------------页面触发播放器方法--------------------------
    play() {
        if (this.player) {
            this.player.play();
        } else {
            this.actionList.push(['play']);
        }
    }
    pause() {
        if (this.player) {
            this.player.pause();
        } else {
            this.actionList.push(['pause']);
        }
    }
    reload(cfg: IConfig) {
        // reload需要销毁的模块不要订阅响应事件
        return RebuildCfg.parseCfg({
            ...cfg,
        }).then((config: IConfig) => {
            extend(false, this.config, config);
            this.bVideo.reload(this.config);
        });
    }
    seek(time: number) {
        if (this.player) {
            this.player.seek(time);
        } else {
            this.actionList.push(['seek', time]);
        }
    }
}
