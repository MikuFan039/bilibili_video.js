const ua = navigator.userAgent.toLowerCase();

export class Browser {
    private static id = 0;

    /**
     * 生命周期内的唯一标志
     */
    static get pid() {
        return ++Browser.id;
    }

    static get safari() {
        const alike =
            /(webkit)[ \/]([\w.]+).*(version)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/.test(ua) ||
            /(version)(applewebkit)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/.test(ua);
        const mseSupported = alike && /version\/1\d/i.test(ua);
        return { alike, mseSupported };
    }

    static get trident() {
        const alike = /Trident/i.test(ua);
        return { alike };
    }

    static get edge() {
        const alike = /edge/i.test(ua);
        return { alike };
    }

    static get gecko() {
        const alike = /Gecko/i.test(ua);
        return { alike };
    }

    static get microMessenger() {
        const alike = /MicroMessenger/i.test(ua);
        return { alike };
    }
}
