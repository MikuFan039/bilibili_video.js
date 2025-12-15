import { getUrlParam } from '../base/url';

/**
 * Conditional Record Performance
 */
const PERF_ENABLED = getUrlParam('parser') === 'nano_perf';
const PERF_CACHE_ONCE = Object.create(null);

export interface ICalculateLoadTimes {
    name: string;
    duration: number;
    requestStart: number;
    entryType: string;
    initiatorType: string;
    nextHopProtocol: string;
    decodedBodySize: number;
    transferSize: number;
    redirectTime: number;
    dnsTime: number;
    tcpTime: number;
    sslTime: number;
    responseTime: number;
}

export const enum NanoMark {
    Index_Head = 'M01',
    Style_Tail = 'M02',
    Instantiate = 'M03',
    Connect_Start = 'M04',
    Store_End = 'M05',
    Play_Url_Start = 'M06',
    Play_Url_End = 'M07',
    Media_Load_Start = 'M08',
    Media_Metadata = 'M09',
    Media_Frame = 'M10',
    Media_Canplay = 'M11',
    Connect_End = 'M12',
    Helper_Com_Head = 'M13',
    Helper_Com_Tail = 'M14',
    Helper_Def_Head = 'M15',
    Helper_Def_Tail = 'M16',
    Helper_Aux_Head = 'M17',
    Helper_Aux_Tail = 'M18',
}

export const enum NanoPerfStage {
    /**
     * @summary 【NavigatorStart】到【入口文件首行代码执行】
     * @desc 用于评估入口脚本的【前置耗时】、【加载耗时】、【解析耗时】
     */
    NavStart_To_IndexHead = 'P01:NS2IH',
    /**
     * @summary 【入口文件首行代码执行】到【实例创建结束】
     * @desc 用于评估入口脚本的【执行耗时】、【实例初始化耗时】
     */
    IndexHead_To_Instantiate = 'P02:IH2I',
    /**
     * @summary 【实例创建结束】到【connectStart】
     * @desc 用于评估页面【链接播放器的等待时间】
     */
    Instantiate_To_ConnectStart = 'P03:I2CS',
    /**
     * @summary 【connectStart】到【storeEnd】
     * @desc 用于评估【Store初始化耗时】
     */
    ConnectStart_To_StoreEnd = 'P04:CS2SE',
    /**
     * @summary 【connectStart】到【playUrlStart】
     * @desc 用于评估【PlayUrl发起前的等待时间】
     */
    ConnectStart_To_PlayUrlStart = 'P05:CS2PUS',
    /**
     * @summary 【connectStart】到【connectEnd】
     * @desc 用于评估【Connect的耗时】
     */
    ConnectStart_To_ConnectEnd = 'P06:CS2CE',
    /**
     * @summary 【playUrlStart】到【playUrlEnd】
     * @desc 用于评估【PlayUrl请求耗时】
     */
    PlayUrlStart_To_PlayUrlEnd = 'P07:PUS2PUE',
    /**
     * @summary 【playUrlEnd】到【mediaLoadStart】
     * @desc 用于评估【加载媒体流之前的等待时间】
     */
    PlayUrlEnd_To_MediaLoadStart = 'P08:PUE2MLS',
    /**
     * @summary 【MediaLoadStart】到【MediaEvents】
     * @desc 用于评估【开始加载媒体流到特定媒体事件的耗时】
     */
    MediaLoadStart_To_MediaMetadata = 'P09:MLS2MM',
    MediaLoadStart_To_MediaFrame = 'P10:MLS2MF',
    MediaLoadStart_To_MediaCanplay = 'P11:MLS2MC',
    /**
     * @summary 【Helper初始化开始】到【Helper初始化结束】
     * @desc 用于评估【Helper初始化耗时】
     */
    HelperComHead_To_HelperComTail = 'P12:HCH2HCT',
    HelperDefHead_To_HelperDefTail = 'P13:HDH2HDT',
    HelperAuxHead_To_HelperAuxTail = 'P14:HAH2HAT',
}

/**
 * Need `Timing-Allow-Origin` HTTP response header
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Resource_Timing_API/Using_the_Resource_Timing_API
 */
export function perfCalcLoadTimes(): ICalculateLoadTimes[] {
    const details: ICalculateLoadTimes[] = [];

    // Check performance support
    if (self.performance == null) {
        return details;
    }

    // Get a list of "resource" performance entries
    let resources = performance.getEntriesByType('resource');

    if (resources == null || resources.length <= 0) {
        return details;
    }

    for (const item of resources) {
        // Redirect time
        const redirectTime: number = item['redirectEnd'] - item['redirectStart'];

        // DNS time
        const dnsTime = item['domainLookupEnd'] - item['domainLookupStart'];

        // TCP handshake time
        const tcpTime = item['connectEnd'] - item['connectStart'];

        // Secure connection time
        const sslTime = item['secureConnectionStart'] > 0 ? item['connectEnd'] - item['secureConnectionStart'] : 0;

        // Response time
        const responseTime = item['responseEnd'] - item['responseStart'];

        // Fetch until response end
        const fetchToResponseEndTime = item['fetchStart'] > 0 ? item['responseEnd'] - item['fetchStart'] : 0;

        // Request start until response end
        const requestStartToResponseEndTime = item['requestStart'] > 0 ? item['responseEnd'] - item['requestStart'] : 0;

        // Start until response end
        const startToResponseEndTime = item.startTime > 0 ? item['responseEnd'] - item.startTime : 0;

        details.push({
            name: item.name,
            duration: item['duration'] || startToResponseEndTime || fetchToResponseEndTime,
            requestStart: item.startTime || item['fetchStart'],
            entryType: item.entryType,
            initiatorType: item['initiatorType'],
            nextHopProtocol: item['nextHopProtocol'],
            decodedBodySize: item['decodedBodySize'],
            transferSize: item['transferSize'],

            redirectTime,
            dnsTime,
            tcpTime,
            sslTime,
            responseTime,
        });
    }

    return details;
}

export function perfFilterLoadTime(nameRegex: RegExp): ICalculateLoadTimes | null {
    const loadTimes = perfCalcLoadTimes();

    for (const item of loadTimes) {
        if (nameRegex.test(item.name)) {
            return item;
        }
    }

    return null;
}

export function perfMark(name: string) {
    try {
        if (typeof performance.mark === 'function') {
            performance.mark(name);
        }
    } catch (e) {
        console.warn(e);
    }
}

export function perfClearMarks(name?: string) {
    if (typeof performance.clearMarks === 'function') {
        performance.clearMarks(name);
    }
}

export function perfMeasure(name: string, startMark?: string, endMark?: string) {
    try {
        if (typeof performance.measure === 'function') {
            performance.measure(name, startMark, endMark);
        }
    } catch (e) {
        console.warn(e);
    }
}

export function perfClearMeasures(name?: string) {
    if (typeof performance.clearMeasures === 'function') {
        performance.clearMeasures(name);
    }
}

/**
 * Conditional Performance Mark
 */
export function perfMarkMod(name: string) {
    if (PERF_CACHE_ONCE[name]) {
        return;
    } else {
        PERF_CACHE_ONCE[name] = 1;
    }
    PERF_ENABLED && perfMark(name);
}

/**
 * Conditional Performance Measure
 */
export function perfMeasureMod(name: string, startMark?: string, endMark?: string) {
    if (PERF_CACHE_ONCE[name]) {
        return;
    } else {
        PERF_CACHE_ONCE[name] = 1;
    }
    PERF_ENABLED && perfMeasure(name, startMark, endMark);
}
