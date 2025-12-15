import { getCookie } from './utils';

class VideoElementUtils {
    static BWP_GREY_MAX_QUALITY = 80;
    static BWP_DISABLE = 'bwphevc_disable';
    static QUALITY_CPU_MAP = { '16': 4, '32': 4, '64': 6, '80': 6, '0': 6 };
    static BLACK_LIST = {
        1: true,
        2: true,
        9: true,
        18: true,
        208259: true,
        1684013: true,
        3479095: true,
        9099524: true,
        12754559: true,
        21673742: true,
        35361273: true,
        40016273: true,
        345039937: true,
        386593697: true,
        9285500: true,
    };

    static getSessionSettings(key: string): string | null {
        try {
            return sessionStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    static setSessionSettings(key: string, val: string) {
        try {
            return sessionStorage.setItem(key, val);
        } catch (e) {
            return null;
        }
    }

    static isDisabledBwpHEVC() {
        if (VideoElementUtils.getSessionSettings(VideoElementUtils.BWP_DISABLE) === '1') {
            return true;
        }
        return false;
    }

    static isBwpHEVCSupportQuality(quality: number, isBwpHEVCPrefSupported: boolean = false) {
        let maxQuality = VideoElementUtils.BWP_GREY_MAX_QUALITY;
        const cpuNum = window?.navigator?.hardwareConcurrency || 0;
        const limitQualityMinCPU = VideoElementUtils.QUALITY_CPU_MAP[quality] || 0;

        if (!limitQualityMinCPU || cpuNum < limitQualityMinCPU) {
            return false;
        }

        if ((quality === 0 && maxQuality !== 80) || quality > maxQuality) {
            return false;
        }

        if (!(window['DashPlayer']?.isBwpHEVCPrefSupported() || isBwpHEVCPrefSupported)) {
            return false;
        }
        return true;
    }

    static isBwpHEVCSupported(
        videoList: Array<any>,
        videoQuality: number,
        isBwpSupported: boolean = false,
        isBwpHEVCPrefSupported: boolean = false,
    ) {
        if (
            VideoElementUtils.BLACK_LIST[getCookie('DedeUserID')] ||
            !isBwpSupported ||
            window.frameElement ||
            !(window.AudioWorklet && window.AudioWorkletNode) ||
            VideoElementUtils.isDisabledBwpHEVC()
        ) {
            return false;
        }

        const hasHevcCodec = (videos: Array<any>) => {
            if (!videos) return false;

            for (let i = 0; i < videos.length; i++) {
                if (videos[i]?.codecid === 12) {
                    return true;
                }
            }

            return false;
        };
        if (!hasHevcCodec(videoList)) {
            return false;
        }

        if (!VideoElementUtils.isBwpHEVCSupportQuality(videoQuality, isBwpHEVCPrefSupported)) {
            return false;
        }

        return true;
    }

    static createVideoElement(
        currentVideoTag: HTMLVideoElement | null,
        videoQuality: number,
        videoList: Array<any>,
        isBwpSupported: boolean = false,
        isBwpHEVCPrefSupported: boolean = false,
    ): HTMLVideoElement | null {
        const createOriginVideoEle = () => {
            window['__ENABLE_WASM_PLAYER__'] = false;
            const v = document.createElement('video');
            v.crossOrigin = 'anonymous';
            return v;
        };

        if (VideoElementUtils.isBwpHEVCSupported(videoList, videoQuality, isBwpSupported, isBwpHEVCPrefSupported)) {
            if (!(currentVideoTag && currentVideoTag.tagName === 'BWP-VIDEO')) {
                if (document.querySelector('bwp-video')) {
                    return createOriginVideoEle();
                }
                window['__ENABLE_WASM_PLAYER__'] = true;
                return <HTMLVideoElement>document.createElement('bwp-video');
            }
        } else {
            if (!(currentVideoTag && currentVideoTag instanceof HTMLVideoElement)) {
                return createOriginVideoEle();
            }
        }

        return null;
    }

    static destroyVideoElement(element: HTMLElement | HTMLVideoElement) {
        if (element instanceof HTMLVideoElement) return;

        if (element && element.tagName === 'BWP-VIDEO' && (<any>element)?.destroy) {
            (<any>element)?.destroy();
        }
    }

    static getCurrentVideoTagName(): string {
        if (window['__ENABLE_WASM_PLAYER__']) {
            return 'bwp-video';
        } else {
            return 'video';
        }
    }

    static isEnabledBwpHEVC(currentVideoTag: HTMLVideoElement | HTMLElement | null): boolean {
        if (window['__ENABLE_WASM_PLAYER__'] && currentVideoTag && currentVideoTag?.tagName === 'BWP-VIDEO') {
            return true;
        } else {
            return false;
        }
    }

    static isNeedSwitchVideoTag(currentVideoTag: HTMLVideoElement, targetQuality: number): boolean {
        const isEnabledBwpHEVC = VideoElementUtils.isEnabledBwpHEVC(currentVideoTag);
        const isBwpHEVCSupportQuality = VideoElementUtils.isBwpHEVCSupportQuality(targetQuality);
        if (isEnabledBwpHEVC === isBwpHEVCSupportQuality) {
            // Not need to switch
            // 1. browser video tag and H.264
            // 2. bwp-video tag and supported quality
            if (isEnabledBwpHEVC && VideoElementUtils.isDisabledBwpHEVC()) {
                return true;
            }

            return false;
        }

        return true;
    }

    static disableBwpHEVC() {
        VideoElementUtils.setSessionSettings(VideoElementUtils.BWP_DISABLE, '1');
    }
}

export { VideoElementUtils };
