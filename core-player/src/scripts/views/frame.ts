import feedback from '../../images/feedback.svg';

// language=HTML
export function frameView(prefix: string) {
    return `
        <div class="${prefix}-area video-state-pause" aria-label="哔哩哔哩播放器">
            <div class="${prefix}-video-wrap">
                <div class="${prefix}-video-state">
                    <div class="${prefix}-video-state-buff-icon"></div>
                    <div class="${prefix}-video-state-buff-text">
                        <span class="${prefix}-video-state-buff-title">正在缓冲...</span>
                        <span class="${prefix}-video-state-buff-speed"></span>
                    </div>
                </div>
                <div class="${prefix}-video-top-core">
                    <div class="${prefix}-video-top-issue" data-text="反馈"  aria-label="反馈" data-position="bottom-center">
                        <span class="${prefix}-video-top-issue-icon">${feedback}</span>
                    </div>
                </div>
                <div class="${prefix}-video-panel">
                    <div class="${prefix}-video-panel-blur">
                        <div class="${prefix}-video-panel-blur-detail"></div>
                    </div>
                    <div class="${prefix}-video-panel-text">
                        <div class="${prefix}-video-panel-row">播放器初始化...</div>
                        <div class="${prefix}-video-panel-row">加载视频内容...</div>
                    </div>
                </div>
                <div class="${prefix}-video-popup"></div>
                <div class="${prefix}-video-subtitle"></div>
                <div class="${prefix}-video-bas-danmaku"></div>
                <div class="${prefix}-video-adv-danmaku"></div>
                <div class="${prefix}-video-danmaku" aria-live="polite"></div>
                <div class="${prefix}-video"></div>
                <div class="${prefix}-video-inner"><div class="${prefix}-video-inner-center"><div class="${prefix}-video-inner-wrap"></div></div></div>
                <div class="${prefix}-video-control-wrap">
                    <div class="${prefix}-video-control-mask"></div>
                    <div class="${prefix}-video-control">
                        <div class="${prefix}-video-control-top"></div>
                        <div class="${prefix}-video-control-bottom">
                            <div class="${prefix}-video-control-bottom-left"></div>
                            <div class="${prefix}-video-control-bottom-center"></div>
                            <div class="${prefix}-video-control-bottom-right"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="${prefix}-video-bottom-area">
                <div class="${prefix}-video-sendbar">
                    <div class="${prefix}-video-sendbar-left"></div>
                    <div class="${prefix}-video-sendbar-right"></div>
                </div>
            </div>
        </div>
        <div class="${prefix}-filter-wrap ${prefix}-bas-danmaku"></div>
    `;
}
