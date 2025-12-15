import { BusinessType } from '../config/base';

interface IQualityInfo {
    value: number;
    name: string;
    svip: boolean | null;
    type: BusinessType;
}

interface IQualityMapping {
    [k: string]: IQualityInfo;
}

export class Quality {
    /**
     * 观看大于此参数的清晰度，用户需要登录（对照组）
     */
    static readonly gtNeedLogin = 32;

    /**
     * 观看大于此参数的清晰度，用户需要登录（实验组）
     */
    static readonly gtNeedLoginABTest = 64;

    /**
     * 非全屏情况观看的最高清晰度
     */
    static readonly gtNeedBigWidth = 80;

    /**
     * 不支持 FLV 时,最大的可用清晰度
     */
    static readonly gtNeedFlvSupported = 64;

    /**
     * 清晰度相关的特性
     */
    static get details(): IQualityInfo[] {
        return [
            {
                value: 0,
                name: '自动',
                svip: null,
                type: BusinessType.all,
            },
            {
                value: 15,
                name: '360P 流畅',
                svip: false,
                type: BusinessType.all,
            },
            {
                value: 16,
                name: '360P 流畅',
                svip: false,
                type: BusinessType.all,
            },
            {
                value: 32,
                name: '480P 清晰',
                svip: false,
                type: BusinessType.all,
            },
            {
                value: 48,
                name: '720P 高清',
                svip: false,
                type: BusinessType.all,
            },
            {
                value: 64,
                name: '720P 高清',
                svip: false,
                type: BusinessType.all,
            },
            {
                value: 74,
                name: '720P60 高清',
                svip: true,
                type: BusinessType.ugc,
            },
            {
                value: 80,
                name: '1080P 高清',
                svip: false,
                type: BusinessType.all,
            },
            {
                value: 112,
                name: '1080P 高码率',

                svip: true,
                type: BusinessType.pgc,
            },
            {
                value: 116,
                name: '1080P 60帧',
                svip: true,
                type: BusinessType.ugc,
            },
            {
                value: 120,
                name: '4K 超清',
                svip: true,
                type: BusinessType.all,
            },
            {
                value: 125,
                name: 'HDR 真彩',
                svip: true,
                type: BusinessType.all,
            },
            {
                value: 126,
                name: '杜比视界',
                svip: true,
                type: BusinessType.all,
            },
            {
                value: 127,
                name: '8K 超高清',
                svip: true,
                type: BusinessType.all,
            },
        ];
    }

    static get mapping() {
        const result: IQualityMapping = {};
        return Quality.details.reduce((pval, cval) => {
            pval[cval.value] = cval;
            return pval;
        }, result);
    }

    static normalize(quality: number | string): number {
        const mapping = {
            1: 16, // deprecated
            2: 64, // deprecated
            3: 80, // deprecated
            4: 112, // deprecated
            48: 64, // deprecated
        };
        return mapping[quality] || +quality;
    }

    static isSuperQuality(quality: number): boolean {
        const mapping = Quality.mapping;
        return Boolean(mapping[quality] && mapping[quality].svip);
    }
}
