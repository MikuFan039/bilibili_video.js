let unhandledEvents: [string, number | string][] = [];
class Analysis {
    track_load?: boolean;
    track_init?: boolean;
    track_frame?: boolean;
    frame_load?: boolean;
    send(type: string, time: number | string, eventid = 'initial_time') {
        if (this.track_load && eventid === 'loaded_time') {
            return;
        } else if (this.track_init && eventid === 'initial_time') {
            return;
        } else if (this.track_frame && eventid === 'frame_time') {
            return;
        }
        if (eventid === 'initial_time') {
            this.track_init = true;
        } else if (eventid === 'loaded_time') {
            this.track_load = true;
            if (window.performance && window.performance.timing && window.performance.timing.reportStart) {
                let timeArray = [];
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
        } else if (eventid === 'frame_time') {
            this.frame_load = true;
        }
        if (window.player && typeof window.player.track === 'function') {
            unhandledEvents.forEach((item) => {
                window.player.track(item[0], item[1]);
            });
            unhandledEvents = [];
            window.player.track(eventid, time);
        } else {
            unhandledEvents.push([eventid, time]);
        }
    }

    sendTrack() {
        if (window.player && typeof window.player.track === 'function') {
            unhandledEvents.forEach((item) => {
                window.player.track(item[0], item[1]);
            });
            unhandledEvents = [];
        }
    }

    resetInitialTime() {
        this.track_init = false;
    }

    reset() {
        this.track_init = false;
        this.track_load = false;
        this.frame_load = false;
    }
}

const analysis = new Analysis();

export default analysis;
