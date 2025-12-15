import './polyfills';

import { Log } from '@shared/utils';
import GrayManager from './component/graymanager';
import EmbedPlayer from './component/embedplayer';
import BPlayer from '@jsc/b-player';

Log.d('Ping1');

window.BPlayer = BPlayer;
window.GrayManager = GrayManager;
window.EmbedPlayer = EmbedPlayer;

window.rec_rp =
    window.rec_rp ||
    function (...args: string[]) {
        (window.rec_rp.q = window.rec_rp.q || []).push(args);
    };

window.player_fullwin = (status: boolean) => {
    const bofqi = document.querySelector('#bilibili-player') || document.querySelector('#bofqi');
    if (window.PlayerAgent && typeof window.PlayerAgent.player_fullwin === 'function') {
        window.PlayerAgent.player_fullwin(status);
    }
    if (status === false) {
        if (bofqi !== null) {
            bofqi.classList.remove('wide');
            document.body.classList.remove('player-mode-widescreen');
        }
    }
    if (status === false && window.ff_embed_stack === null) {
        return;
    }
    if (window.ff_embed_stack === null) {
        window.ff_embed_stack = [];
        window.ff_embed_stack_style = [];
        let pObj = bofqi;
        do {
            if (pObj !== null) {
                pObj.setAttribute('embed_stack', 'true');
                window.ff_embed_stack.push(pObj);
                pObj = pObj.parentNode as Element; //临时改成as Element，后面建议改成pObj.parentElement
            }
        } while (pObj);
    }
    if (status) {
        // for compatible old version
        if (bofqi !== null) {
            bofqi.classList.add('webfullscreen');
            document.body.classList.add('player-mode-webfullscreen');
            document.body.classList.add('player-fullscreen-fix');
        }
    } else {
        if (bofqi !== null) {
            bofqi.classList.remove('webfullscreen');
            document.body.classList.remove('player-mode-webfullscreen');
            document.body.classList.remove('player-fullscreen-fix');
        }
    }
};

window.PlayerSetOnline = (num: number) => {
    if (window.PlayerAgent && typeof window.PlayerAgent.PlayerSetOnline === 'function') {
        window.PlayerAgent.PlayerSetOnline(num);
    }
};

window.player_widewin = () => {
    const bofqi = document.querySelector('#bilibili-player') || document.querySelector('#bofqi');
    if (bofqi !== null) {
        bofqi.classList.remove('webfullscreen');
        bofqi.classList.add('wide');
        document.body.classList.remove('player-mode-webfullscreen');
        document.body.classList.remove('player-fullscreen-fix');
        document.body.classList.add('player-mode-widescreen');
        if (window.PlayerAgent && typeof window.PlayerAgent.player_widewin === 'function') {
            window.PlayerAgent.player_widewin();
        }
    }
};

window.heimu = (api: number, b: number) => {
    let heimu: HTMLElement | null = document.querySelector('#heimu');
    if (!heimu) {
        const head = document.querySelector('head');
        if (head) {
            head.insertAdjacentHTML(
                'beforeend',
                '<style id="black-mask">#heimu {background: #000; position: fixed; top: 0; left: 0; display: none; height: 100%; width: 100%; opacity: 0.9; z-index: 10015;} .player-mode-blackmask #bofqi {z-index: 10016; position: relative !important} .player-mode-blackmask #bilibili-player {z-index: 10016; position: relative !important}</style>',
            );
        }
        document.body.insertAdjacentHTML('beforeend', '<div id="heimu"></div>');
        heimu = document.querySelector('#heimu');
    }
    if (b === 0) {
        if (heimu !== null) {
            heimu.style.display = 'none';
            document.body.classList.remove('player-mode-blackmask');
        }
    } else {
        if (heimu !== null) {
            document.body.classList.add('player-mode-blackmask');
            heimu.style.opacity = `.${api / 10}`;
            heimu.style.filter = `alpha(opacity=${api})`;
            heimu.style.display = 'block';
        }
    }
};

window.getAuthorInfo = () => {
    let upInfo,
        uname,
        face,
        attention = false;
    const mid = parseInt(window.mid, 10);
    if (window.AttentionList && window.AttentionList.indexOf(mid) >= 0) {
        attention = true;
    }
    upInfo = document.querySelector('.upinfo');
    if (upInfo) {
        const name = upInfo.querySelector('.name');
        if (name !== null) {
            // @ts-ignore
            uname = name.textContent(); //此处代码猜测有问题，建议后面修改为name.textContent
        }
        const faceImg = upInfo.querySelector('.u-face img');
        if (faceImg !== null) {
            face = faceImg.getAttribute('src');
        }
    } else {
        upInfo = document.querySelector('.zu_play_info');
        if (upInfo) {
            const userA = upInfo.querySelector('.upload_user a');
            if (userA !== null) {
                uname = userA.getAttribute('card');
            }
            const userImg = upInfo.querySelector('.upload_user img');
            if (userImg !== null) {
                face = userImg.getAttribute('src');
            }
        }
    }
    return {
        mid,
        uname,
        face,
        attention,
    };
};

window.flashChecker = () => {
    let hasFlash = false, // 是否安装了flash
        flashVersion = 0; // flash版本
    const isIE =
        (!!/msie [\w.]+/.exec(navigator.userAgent.toLowerCase()) && !/Edge/i.test(navigator.userAgent)) ||
        /Trident/i.test(navigator.userAgent); // 是否IE浏览器
    if (isIE) {
        try {
            const swf = new window.ActiveXObject('ShockwaveFlash.ShockwaveFlash');
            if (swf) {
                hasFlash = true;
                const vSwf = swf.GetVariable('$version');
                flashVersion = parseInt(vSwf.split(' ')[1].split(',')[0], 10);
            }
        } catch (e) {
            console.error(e);
        }
    } else if (navigator.plugins && navigator.plugins.length > 0) {
        const swf = navigator.plugins['Shockwave Flash'];
        if (swf) {
            hasFlash = true;
            const words = swf.description.split(' ');
            for (let i = 0; i < words.length; ++i) {
                if (!isNaN(parseInt(words[i], 10))) {
                    flashVersion = parseInt(words[i], 10);
                }
            }
        }
    }
    return {
        hasFlash,
        flashVersion,
    };
};

window.deltaFilter = (event: WheelEvent) => {
    let delta = 0;
    if (event['wheelDelta'] || event.deltaY) {
        delta = (event['wheelDelta'] || -event.deltaY * 40) / 40;
        if (window.opera) {
            delta = -delta;
        }
    } else if (event.detail) {
        delta = -event.detail;
    }
    return delta;
};
