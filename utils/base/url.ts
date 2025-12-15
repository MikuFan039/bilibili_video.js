export function getQueryString(url: string): string {
    const searchIndex = url.indexOf('?');
    const hashIndex = url.indexOf('#');

    if (searchIndex === -1) {
        return '';
    } else if (hashIndex === -1) {
        return url.slice(searchIndex, url.length);
    }

    return url.slice(searchIndex, hashIndex);
}

export function getUrlParam(name: string, url?: string): string | null {
    const queryString = typeof url === 'string' ? getQueryString(url) : self.location.search;
    const reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)', 'i');
    const r = queryString.substr(1).match(reg);

    if (r != null) {
        try {
            return decodeURIComponent(r[2]);
        } catch (e) {
            return null;
        }
    }

    return null;
}
