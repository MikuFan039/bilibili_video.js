import { utils } from '@shared/utils';
import analysis from '../plugins/analysis';
import PlayerSelector from './player-selector';
import BVideo from './b-video';
import { CorePlayer } from '@jsc/core-player';
import { EventType } from '@jsc/namespace';
import { IConfig } from '../player';

export default class H5Player {
    player: any;
    bVideo: BVideo;
    private corePlayer: any;
    private h5Params: any;
    private isLoadingPlayerjs: Promise<any> | null;

    constructor(private playerSelector: PlayerSelector, public config: IConfig) {
        this.bVideo = playerSelector.bVideo;
        this.h5Params = null;
        this.isLoadingPlayerjs = null;
        this.init();
    }

    private init() {
        const params = this.config;

        params.dashSymbol = true;
        params.element = this.bVideo.element;
        utils.cookie.set('CURRENT_FNVAL', '16');

        const loadBilibiliPlayer = (corePlayer: any, done: boolean) => {
            this.h5Params = {
                done,
                params,
                corePlayer,
            };
            if (this.isLoadingPlayerjs) {
                return;
            }
            this.isLoadingPlayerjs = import(/* webpackChunkName: "player" */ '@jsc/bilibiliplayer').then((s) => {
                window.BilibiliPlayer = s.BilibiliPlayer;
                this.newH5Player();
                this.h5Params = null;
                this.isLoadingPlayerjs = null;
            });
        };
        if (window.BilibiliPlayer) {
            this.initH5Player(params);
        } else {
            this.corePlayer = new CorePlayer(params, this.bVideo);
            this.corePlayer.loadedmetadata
                .then((corePlayer: any) => loadBilibiliPlayer(corePlayer, true))
                .catch((corePlayer: any) => loadBilibiliPlayer(corePlayer, false));
        }
    }

    private newH5Player() {
        if (!this.h5Params) {
            return;
        }
        if (this.h5Params.done) {
            this.initH5Player(this.h5Params.params, this.h5Params.corePlayer);
        } else {
            this.h5Params.corePlayer?.destroy();
            this.initH5Player(this.h5Params.params);
        }
        this.corePlayer = null;
    }
    private initH5Player(params: any, corePlayer?: any) {
        this.player?.destroy();
        this.player = new window.BilibiliPlayer(params, corePlayer, this.bVideo);
        analysis.sendTrack(this.player);
        this.afterInit(this.player);
    }

    private afterInit(player: any) {
        this.bVideo.bplayer.player = player;
        this.bVideo.emit(EventType.inited);
        const actionList = this.bVideo.bplayer.actionList;
        let action;
        while (actionList.length) {
            action = actionList.shift();
            if (action && typeof this.player[action[0]] === 'function') {
                this.player[action[0]](...action.slice(1));
            }
        }
    }

    reload(config: IConfig) {
        this.config = config;
        this.init();
    }
    destroy() {
        this.corePlayer?.destroy();
        delete window['__playinfo__'];
        this.player?.pause();
        this.player?.destroy();
    }
}
