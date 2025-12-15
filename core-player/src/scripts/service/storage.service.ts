import { K_PLAYER_SETTINGS } from '../config/base';
import { defQuality, defVolume } from '../config/video';
import { Quality } from '../utils/quality';
import { getLocalSettings, setLocalSettings } from '../utils/general';

export interface IStorageConfig {
    volume: number;
    quality: number;
    dolbyAtmos: boolean;
}

export class StorageService implements IStorageConfig {
    private readonly data: any;

    constructor() {
        try {
            const text = getLocalSettings(K_PLAYER_SETTINGS);
            if (text == null) {
                this.data = {};
            } else {
                this.data = Object(JSON.parse(text));
            }
        } catch (e) {
            this.data = {};
        }
    }

    get volume() {
        try {
            return +this.data['video_status']['volume'] || defVolume;
        } catch (e) {
            return defVolume;
        }
    }

    get quality() {
        try {
            return Quality.normalize(this.data['setting_config']['defquality']) || defQuality;
        } catch (e) {
            return defQuality;
        }
    }

    get dolbyAtmos() {
        try {
            return this.data['setting_config']['dolbyAtmos'] || false;
        } catch (e) {
            return false;
        }
    }
    set dolbyAtmos(val) {
        try {
            const text = getLocalSettings(K_PLAYER_SETTINGS);
            let settings;
            if (text == null) {
                settings = {};
            } else {
                settings = Object(JSON.parse(text));
            }
            settings['setting_config']['dolbyAtmos'] = val;
            setLocalSettings(K_PLAYER_SETTINGS, JSON.stringify(settings));
        } catch (e) {
            return;
        }
    }
}
