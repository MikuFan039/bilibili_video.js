/**
 * @nosideeffects
 */
export function noop() {
    /** It does nothing */
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
 */
export function assign(target: object, ...rest: any[]): any {
    if (target == null) {
        throw new TypeError('Cannot convert undefined or null to object');
    }
    const to = Object(target);
    for (let i = 0; i < rest.length; i++) {
        const nextSource = rest[i];
        if (nextSource != null) {
            // Skip over if undefined or null
            for (const nextKey in nextSource) {
                // Avoid bugs when hasOwnProperty is shadowed
                if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                    to[nextKey] = nextSource[nextKey];
                }
            }
        }
    }
    return to;
}

export function bufferFromBase64(b64: string) {
    try {
        const bin = window.atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
            bytes[i] = bin.charCodeAt(i);
        }
        return <ArrayBuffer>bytes.buffer;
    } catch (e) {
        return;
    }
}

export function getCookie(cookieName: string): string | null {
    if (cookieName == null) {
        return null;
    }
    const cookies = document.cookie.split(';');
    const decodeCookieName = decodeURIComponent(cookieName);
    for (let i = 0; i < cookies.length; i++) {
        const [key, value] = cookies[i].trim().split('=');
        if (decodeURIComponent(key) === decodeCookieName) {
            return decodeURIComponent(value);
        }
    }
    return null;
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
        } catch (e) {
            // tslint:disable-next-line
            console.warn(e);
        }
    } else {
        return setCookie(key, val);
    }
}

export function getHiddenProp() {
    const prefixes = ['webkit', 'moz', 'ms', 'o'];

    // If 'hidden' is natively supported just return it
    if ('hidden' in document) {
        return { prefix: '', name: 'hidden' };
    }

    // Otherwise loop over all the known prefixes until we find one
    for (let i = 0; i < prefixes.length; i++) {
        const prop = prefixes[i] + 'Hidden';
        if (prop in document) {
            return { prefix: prefixes[i], name: prop };
        }
    }

    // Otherwise it's not supported
    return null;
}

export function isDocumentHidden(): boolean {
    const prop = getHiddenProp();
    if (!prop) {
        return false;
    }
    return document[prop.name];
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

export function thumbnail(url: string, width: number, height?: number, qc?: boolean): string {
    height = height || width;
    let queryString = '';
    // 暂存 url 中查询参数，拼到 url 最后
    if (url && url.split) {
        queryString = url.split('?')[1];
    }
    if (url && url.slice && url.indexOf) {
        const pos = url.indexOf('?');
        if (pos > -1) {
            url = url.slice(0, pos);
        }
    }
    const getUrlExt = (url: string) => {
        if (url && url.split) {
            return url.split('.').pop()!.toLowerCase();
        }
    };
    const validateBfsUrl = (url: string) => {
        // url 是否为 string
        if (!url || typeof url !== 'string') {
            return false;
        }
        // 文件格式是否支持
        const supportedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
        if (supportedExts.indexOf(getUrlExt(url)!) === -1) {
            return false;
        }
        // 路径是否包含 /bfs/
        if (url.indexOf('/bfs/') === -1) {
            return false;
        }
        return true;
    };
    const removeBfsParams = (url: string) => {
        let trimmedUrl = url;
        if (url && url.slice && url.indexOf) {
            const pos = url.indexOf('@');
            if (pos > -1) {
                trimmedUrl = url.slice(0, pos);
            }
        }
        return trimmedUrl;
    };
    const appendQueryString = (url: string, queryString: string) => {
        return queryString && queryString !== '' ? `${url}?${queryString}` : url;
    };
    const isNumeric = (n: number | string) => {
        return !isNaN(parseFloat(<string>n)) && isFinite(<number>n);
    };
    const appendUrlParam = (url: string, param: string, value: number) => {
        url += url.indexOf('@') === -1 ? '@' : '_';
        url += value + param;
        return url;
    };
    const setSize = (url: string, width: number, height: number, qc?: boolean) => {
        // 设置宽高
        if (isNumeric(width) && width > 0) {
            url = appendUrlParam(url, 'w', Math.round(width));
        }
        if (isNumeric(height) && height > 0) {
            url = appendUrlParam(url, 'h', Math.round(height));
        }
        if (qc) {
            url = appendUrlParam(url, 'Q', 100);
            url = appendUrlParam(url, 'c', 1);
        }
        return url;
    };
    // 检查 url 是否符合 bfs 规范，若不合法，直接返回url
    if (!validateBfsUrl(removeBfsParams(url))) {
        return appendQueryString(url, queryString);
    }
    // 移除 url 中 @ 后的 bfs 参数
    url = removeBfsParams(url);
    // 设置宽高
    url = setSize(url, width, height, qc);
    // 设置 url 后缀名
    url = appendQueryString(url, queryString);
    return url;
}
