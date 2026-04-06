// src/engine/AudioCore.js
import { HapticEngine } from './HapticEngine.js'; // ★ 追加：触覚エンジンのインポート

export class AudioCore {
    constructor() {
        // ブラウザのWeb Audio APIを初期化
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.isMuted = true;
        this.heartbeatTimer = null;
        this.bpm = 153; // あなたの指定した鼓動のリズム！
    }

    // ユーザーがスイッチを入れた時にオーディオを起動する
    async toggle(isEnable) {
        this.isMuted = !isEnable;
        
        if (isEnable) {
            // ブラウザの制約を解除して音を鳴らせるようにする
            if (this.ctx.state === 'suspended') {
                await this.ctx.resume();
            }
            this.startHeartbeat();
            this.playSystemSound(440, 'sine', 0.1); // 起動音（ピコン！）
            HapticEngine.playTap(); // ★ 追加：起動時のスイッチ感触
        } else {
            this.stopHeartbeat();
        }
    }

    // 153bpmの重低音パルス（心音）
    startHeartbeat() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        const intervalMs = 60000 / this.bpm; // 153bpm = 約392ミリ秒間隔
        
        this.heartbeatTimer = setInterval(() => {
            if (this.isMuted) return;
            
            // ★ 追加：153bpmの物理的な鼓動（スマホがトクン…と震える）
            HapticEngine.playPulse();

            // ズンッ…という重低音のキックドラムを生成
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            
            // 周波数を急激に下げることで「ドンッ」というキック音にする
            osc.frequency.setValueAtTime(150, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
            
            // 音量の減衰
            gain.gain.setValueAtTime(0.3, this.ctx.currentTime); // 重低音のボリューム調整
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.3);
        }, intervalMs);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    // 🌟 星を創った時の音（高音のキラッとした音）
    playSpawn() {
        if (this.isMuted) return;
        this.playSystemSound(880, 'sine', 0.15, 1760);
        HapticEngine.playSpawn(); // ★ 追加：生成時のトトッという感触
    }

    // 🎒 星を消した時・亜空間へ送った時の音（低く吸い込まれる音）
    playDelete() {
        if (this.isMuted) return;
        this.playSystemSound(200, 'sawtooth', 0.2, 50);
        HapticEngine.playDelete(); // ★ 追加：消去時のズンッという重い感触
    }

    // 🌌 ワープ（階層移動）した時の音
    playWarp() {
        if (this.isMuted) return;
        this.playSystemSound(400, 'triangle', 0.3, 800);
        HapticEngine.playWarp(); // ★ 追加：ワープ時のダダダダッという感触
    }

    // 汎用的なシンセサイザー発音機
    playSystemSound(startFreq, type, duration, endFreq = null) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        
        osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
        if (endFreq) {
            osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
        }
        
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime); // 全体的なボリューム
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
}