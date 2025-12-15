let unhandledEvents: [string, number | string][] = [];
const analysis = {
    track_init: false,
    track_frame: false,
    frame_load: false,

    send(time: number | string, eventid = 'initial_time', player?: any) {
        let timeArray = [];
        switch (eventid) {
            case 'initial_time':
                if (this.track_init) {
                    return;
                }
                this.track_init = true;
                break;
            case 'frame_time':
                if (this.track_frame) {
                    return;
                }
                this.frame_load = true;
                break;
            case 'loaded_time':
                if (window.performance && window.performance.timing && window.performance.timing.reportStart) {
                    const timeList = [
                        'navigationStart',
                        'responseEnd',
                        'reportStart',
                        'reportLoaded',
                        'reportEnd',
                        'initialStateStart',
                        'initialStateEnd',
                        'stardustCssStart',
                        'stardustCssEnd',
                        'jqueryStart',
                        'jqueryLoaded',
                        'jqueryEnd',
                        'stardustOtherStart',
                        'stardustOtherEnd',
                        'videoJsStart',
                        'videoJsLoaded',
                        'videoJsEnd',
                        'embedPlayerStart',
                        'embedPlayerEnd',
                    ];
                    for (let i = 0; i < timeList.length; i++) {
                        timeArray.push(window.performance.timing[timeList[i]] || 0);
                    }
                    unhandledEvents.push(['start_time_detail', timeArray.join(',')]);
                }
                break;
            default:
                break;
        }
        if (player && typeof player.track === 'function') {
            unhandledEvents.forEach((item) => {
                player.track(item[0], item[1]);
            });
            unhandledEvents = [];
            player.track(eventid, time);
        } else {
            unhandledEvents.push([eventid, time]);
        }
    },

    sendTrack(player?: any) {
        if (player && typeof player.track === 'function') {
            unhandledEvents.forEach((item) => {
                player.track(item[0], item[1]);
            });
            unhandledEvents = [];
        }
    },

    resetInitialTime() {
        this.track_init = false;
    },

    reset() {
        this.track_init = false;
        this.track_load = false;
        this.frame_load = false;
    },
};

export default analysis;
