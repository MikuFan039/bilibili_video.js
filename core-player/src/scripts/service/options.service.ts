export interface IPlayerConfig {
    element: HTMLElement;
    seasonType: number;
    playerType: number;
    aid: number;
    cid: number;
    bvid: string;
    seasonId: number;
    episodeId: number;
    enableSSLResolve: boolean;
    enableSSLStream: boolean;
    extraParams: string;
    dashSymbol: boolean;
    lightWeight: boolean;
    inner: boolean;
    type: number;
    quality: number;
    upPreview: boolean;
    poster: number;
    muted: boolean;
    asWide: boolean;
    activityKey: string;
    highQuality: string;
    pageVersion?: number; // 新播放页版本：0-旧播放页；1-新播放页方案一；2-新播放页方案二
}

export class OptionsService implements IPlayerConfig {
    constructor(private readonly input: any) {
        if (this.input == null) {
            throw new Error('Input must not be null or undefined');
        }
    }

    get element() {
        return this.input['element'] || document.getElementById('bilibiliPlayer');
    }

    get seasonType() {
        return +this.input['season_type'] || 0;
    }

    get playerType() {
        return +this.input['player_type'] || 0;
    }

    get aid() {
        return +this.input['aid'];
    }

    get cid() {
        return +this.input['cid'];
    }

    get bvid() {
        if (+this.input['show_bv']) {
            return this.input['bvid'] || '';
        } else {
            return '';
        }
    }

    get seasonId() {
        return +this.input['seasonId'];
    }

    get episodeId() {
        return +this.input['episodeId'];
    }

    get enableSSLResolve() {
        if (this.input['enable_ssl_resolve'] === undefined) {
            return true;
        } else {
            return Boolean(this.input['enable_ssl_resolve']);
        }
    }

    get enableSSLStream() {
        if (this.input['enable_ssl_stream'] === undefined) {
            return true;
        } else {
            return Boolean(this.input['enable_ssl_stream']);
        }
    }

    get extraParams() {
        return this.input['extra_params'] || '';
    }

    get dashSymbol() {
        if (this.input['dashSymbol'] === undefined) {
            return true;
        } else {
            return Boolean(this.input['dashSymbol']);
        }
    }

    get lightWeight() {
        return Boolean(this.input['lightWeight']);
    }

    get inner() {
        return Boolean(this.input['inner']);
    }
    get quality(): number {
        return Number(this.input.quality);
    }
    get type() {
        return Number(this.input['type']);
    }
    get upPreview() {
        return Boolean(this.input['upPreview']);
    }
    get poster() {
        return +this.input['poster'];
    }
    get muted(): boolean {
        return Boolean(this.input['muted']);
    }
    get asWide(): boolean {
        return Boolean(this.input['as_wide']);
    }
    get activityKey(): string {
        return this.input['activityKey'];
    }
    get highQuality(): string {
        return this.input['highQuality'];
    }
    get pageVersion(): number {
        return +(this.input['pageVersion'] ?? 0);
    }
}
