import md5 from 'md5';

export interface IAjax {
    url: string;
    method?: string;
    contentType?: string;
    async?: boolean;
    withCredentials?: boolean;
    data?: any;
}

export function getSessionID(): string {
    return md5(String(getCookie('buvid3') || Math.floor(Math.random() * 100000).toString(16)) + +new Date());
}

export function getSearchParam(name: string, url?: string): string | null {
    let searchIndex: number;
    let hashIndex: number;
    let searchString: string;
    if (typeof url === 'string') {
        searchIndex = url.indexOf('?');
        hashIndex = url.indexOf('#');
        if (searchIndex === -1) {
            searchString = '';
        } else if (hashIndex === -1) {
            searchString = url.slice(searchIndex, url.length);
        } else {
            searchString = url.slice(searchIndex, hashIndex);
        }
    } else {
        searchString = window.location.search;
    }
    const reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)', 'i');
    const r = searchString.substr(1).match(reg);
    if (r != null) {
        try {
            return decodeURIComponent(r[2]);
        } catch (e) {
            return null;
        }
    }
    return null;
}

export function fmSeconds(sec: number): string {
    if (sec == null) {
        sec = 0;
    }
    let ret: string;
    sec = Math.ceil(sec) >> 0;
    ret = ('0' + (sec % 60)).slice(-2);
    ret = Math.floor(sec / 60) + ':' + ret;
    if (ret.length < 5) {
        ret = '0' + ret;
    }
    return ret;
}

export function fmSecondsAPP(sec: number): string {
    if (sec == null) {
        sec = 0;
    }
    let ret: string;
    let second;
    let minute;
    let hour;
    sec = Math.floor(sec) >> 0;
    hour = Math.floor(sec / 3600);
    minute = Math.floor((sec - hour * 3600) / 60);
    second = sec - hour * 3600 - minute * 60;
    ret = `${hour ? hour + ':' : ''}${minute}:${('0' + second).slice(-2)}`;
    return ret;
}

export function colorFromInt(value: number): string {
    return '#' + ('00000' + value.toString(16)).slice(-6);
}

export function htmlEncode(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2f;')
        .replace(/\n/g, '<br>');
}

export function isPlainObject(obj: any) {
    if (typeof obj !== 'object' || obj.nodeType || (obj !== null && obj !== undefined && obj === obj.window)) {
        return false;
    }

    if (obj.constructor && !Object.prototype.hasOwnProperty.call(obj.constructor.prototype, 'isPrototypeOf')) {
        return false;
    }

    return true;
}

export function qualityMap(quality: number): number {
    const mapping = {
        1: 16, // deprecated
        2: 64, // deprecated
        3: 80, // deprecated
        4: 112, // deprecated
        48: 64, // deprecated
    };
    return mapping[quality] || quality;
}

export function getCookie(cookieName: string): string {
    const defaultResult = '';
    if (cookieName == null) {
        return defaultResult;
    }
    const cookies = document.cookie.split(';');
    const decodeCookieName = decodeURIComponent(cookieName);
    for (let i = 0; i < cookies.length; i++) {
        const [key, value] = cookies[i].trim().split('=');
        if (decodeURIComponent(key) === decodeCookieName) {
            return decodeURIComponent(value);
        }
    }
    return defaultResult;
}

export function setCookie(name: string, value: string, days: number = 365) {
    const date = new Date();
    const encodeName = encodeURIComponent(name);
    const encodeValue = encodeURIComponent(value);
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${encodeName}=${encodeValue}; expires=${date.toUTCString()}; path=/; domain=.bilibili.com`;
}

export function getLocalSettings(key: string): string | null {
    if (window.localStorage && localStorage.getItem) {
        return localStorage.getItem(key);
    } else {
        return getCookie(key);
    }
}

export function setLocalSettings(key: string, val: string) {
    if (window.localStorage && localStorage.setItem) {
        try {
            return localStorage.setItem(key, val);
        } catch (e) {}
    } else {
        return setCookie(key, val);
    }
}

export function fmDate(dateString: number | string, separator = '', hasYear = true): string {
    let date = new Date(dateString);
    // 兼容不同时区
    date = new Date(+date + (new Date().getTimezoneOffset() + 8 * 60) * 60 * 1000);
    const year = date.getFullYear() + '';
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return `${hasYear ? year + separator : ''}${month}${separator}${day}`;
}

const hasOwnProperty = Object.prototype.hasOwnProperty;
export const hasOwn = (val: object, key: string | symbol) => hasOwnProperty.call(val, key);

export const isObject = (val: unknown): val is Record<any, any> => val !== null && typeof val === 'object';

export function ajax(obj: IAjax) {
    return new Promise((resolve, reject) => {
        const method = obj.method ? obj.method.toUpperCase() : 'GET';
        const async = obj.async ?? true;
        const xhr = new XMLHttpRequest();
        xhr.withCredentials = obj.withCredentials ?? true;

        xhr.addEventListener('load', () => {
            resolve(xhr.response);
        });
        xhr.addEventListener('error', () => {
            reject(xhr);
        });
        xhr.addEventListener('abort', () => {
            reject(xhr);
        });
        if (method === 'POST') {
            xhr.open(method, obj.url, async);
            xhr.setRequestHeader('Content-type', obj.contentType || 'application/x-www-form-urlencoded');
            xhr.send(obj.data);
        } else if (method === 'GET') {
            const data = obj.data ? `?${objToStr(obj.data)}` : '';
            const url = `${obj.url}${data}`;
            xhr.open(method, url, async);
            xhr.send();
        } else {
            xhr.open(method, obj.url);
            xhr.send();
        }
    });
}

export function objToStr(obj: any) {
    let oStr = '';
    for (let key in obj) {
        oStr += `${key}=${obj[key]}&`;
    }
    return oStr.slice(0, -1);
}

export const browser = {
    get version() {
        const ua = navigator.userAgent.toLowerCase();
        const isSafari =
            /(webkit)[ \/]([\w.]+).*(version)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/.test(ua) ||
            /(version)(applewebkit)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/.test(ua);
        const match = /(chrome)[ \/]([\w.]+)/.exec(ua) || '';
        const matched = {
            browser: match[5] || match[3] || match[1] || '',
            version: match[4] || match[2] || '0',
        };
        let version = 0;
        if (matched.browser) {
            version = parseInt(matched.version, 10);
        }
        const iosVer = ua.match(/cpu iphone os (.*?) like mac os/);
        return {
            // 浏览器
            browser: matched.browser,
            version: version,
            iosVer: iosVer ? iosVer[1] : '',

            // 系统
            linux: /Linux/i.test(ua),
            tesla: /Tesla/i.test(ua),

            // 内核
            webKit: /AppleWebKit/i.test(ua),
            gecko: /Gecko/i.test(ua) && !/KHTML/i.test(ua),
            trident: /Trident/i.test(ua),
            presto: /Presto/i.test(ua),

            // 手机
            mobile: /AppleWebKit.*Mobile.*/i.test(ua),
            iOS: /Mac OS X[\s_\-\/](\d+[.\-_]\d+[.\-_]?\d*)/i.test(ua),
            iPhone: /iPhone/i.test(ua),
            iPad: /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
            webApp: !/Safari/i.test(ua),
            android: /Android/i.test(ua),
            windowsPhone: /Windows Phone/i.test(ua),
            // 微信 + 企业微信
            microMessenger: /MicroMessenger/i.test(ua),
            // 仅企业微信
            microWorkMessenger: /wxwork/i.test(ua),
            // 仅微信
            wx: /MicroMessenger/i.test(ua) && !/wxwork/i.test(ua),
            mqq: /MQQBrowser/i.test(ua) || /MicroMessenger/i.test(ua) || /MMWEBSDK/i.test(ua) || /WeChat/i.test(ua),
            vivo: /VivoBrowser/i.test(ua),

            // 桌面
            msie: /msie [\w.]+/i.test(ua),
            edge: /edge/i.test(ua),
            edgeBuild16299: /(\s|^)edge\/16.16299(\s|$)/i.test(ua),
            safari: isSafari,
            safariSupportMSE: isSafari && /Version\/1\d/i.test(ua),
        };
    },
};

export function extend(deep = false, target = {}, ...arg: any): any {
    if (isNotObj(target)) {
        target = {};
    }
    if (arg && arg.length) {
        let options = arg.shift();
        if (isNotObj(options)) {
            options = {};
        }
        let value;
        for (const key in options) {
            if (Object.prototype.hasOwnProperty.call(options, key)) {
                value = options[key];
                if (deep && !isNotObj(value)) {
                    if (Array.isArray(value)) {
                        if (!Array.isArray(target[key])) {
                            target[key] = [];
                        }
                        target[key] = extend(true, target[key], value);
                    } else {
                        if (isNotObj(target[key])) {
                            target[key] = {};
                        }
                        target[key] = extend(true, target[key], value);
                    }
                } else {
                    target[key] = value;
                }
            }
        }

        if (arg.length) {
            return extend(deep, target, ...arg);
        } else {
            return target;
        }
    } else {
        return target;
    }
}

export function isNotObj(obj: any) {
    return obj === null || typeof obj !== 'object';
}

export function throttle(fn: Function, delay: number) {
    let flag = true;
    return (...arg: any) => {
        // 开关打开时，执行任务
        if (flag) {
            fn(...arg);
            flag = false;
            // delay时间之后，任务开关打开
            setTimeout(() => {
                flag = true;
            }, delay);
        }
    };
}

export function isSupportWebGL() {
    let canvas = document.createElement('canvas');
    let gl: WebGL2RenderingContext | WebGLRenderingContext | null;
    let debugInfo: WEBGL_debug_renderer_info | null;
    let vendor = '';
    let renderer = '';
    try {
        gl =
            canvas.getContext('webgl2') ||
            canvas.getContext('webgl') ||
            <WebGLRenderingContext | null>canvas.getContext('experimental-webgl');
        if (gl) {
            debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            }
        }
    } catch (e) {
        console.warn(e);
    }
    return !!(renderer || vendor);
}

export function formatNum(n: any) {
    const num = parseInt(n, 10);
    if (num < 0 || n == null || n === undefined) {
        return '--';
    }
    if (String(n).indexOf('.') !== -1 || String(n).indexOf('-') !== -1) {
        return n;
    }
    if (num === 0) {
        return 0;
    }
    n = num;
    if (n >= 10000 && n < 100000000) {
        return (n / 10000).toFixed(n % 10000 > 500 && n % 10000 < 9500 ? 1 : 0) + '万';
    } else if (n >= 100000000) {
        return (n / 100000000).toFixed(n % 1e8 > 5e6 && n % 1e8 < 9.5e7 ? 1 : 0) + '亿';
    } else {
        return n;
    }
}

export const fmDateForTip = (t: number | string) => {
    if (!t) return;
    t = Number(t);
    const now = new Date();
    const date = new Date(t);

    const diff = now.getTime() - t;

    const minuteUnit = 1000 * 60;
    const hourUnit = 1000 * 60 * 60;
    const today = new Date(now.toLocaleDateString()).getTime();
    const start = new Date(now.toLocaleDateString());
    const yesterday = start.setTime(start.getTime() - 3600 * 1000 * 24 * 1);

    if (diff < minuteUnit) {
        // 刚刚
        return `刚刚`;
    } else if (diff < hourUnit) {
        // n分钟前
        return `${Math.floor(diff / 60 / 1000)}分钟前`;
    } else if (t > today) {
        // n小时前
        return `${Math.floor(diff / 3600 / 1000)}小时前`;
    } else if (t > yesterday) {
        // 昨天
        return `昨天`;
    } else if (date.getFullYear() === now.getFullYear()) {
        // 月-日
        return fmDate(t, '-', false);
    } else {
        // 年-月-日
        return fmDate(t, '-');
    }
};
