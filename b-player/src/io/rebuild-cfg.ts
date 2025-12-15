const compare = {
    showBv: 'show_bv',
    asWide: 'as_wide',
    lastPlayTime: 'lastplaytime',
    lastEpid: 'last_ep_id',
    playerType: 'player_type',
    seasonType: 'season_type',
    sslResolve: 'enable_ssl_resolve',
    sslStream: 'enable_ssl_stream',
    hasNext: 'has_next',
    extraParams: 'extra_params',
};
import { getAllCid } from '@jsc/b-io';
import { getCookie, browser } from '@shared/utils';

export default class RebuildCfg {
    static async parseCfg(config: any) {
        for (const key in config) {
            if (config.hasOwnProperty(key) && compare[key]) {
                config[compare[key]] = config[key];
            }
        }
        config.touchMode = Boolean(config.touchMode ?? (browser.version.iPad || browser.version.tesla));
        config.buvid = getCookie('buvid3') || '';
        await getAllCid(config);
        return config;
    }
}
