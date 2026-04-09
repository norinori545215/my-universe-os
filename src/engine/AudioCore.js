// src/engine/AudioCore.js
import { HapticEngine } from './HapticEngine.js'; // ★ 触覚エンジン

export class AudioCore {
    constructor() {
        // ブラウザのWeb Audio APIを初期化
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.isMuted = true;
        this.heartbeatTimer = null;
        this.bpm = 153; // あなたの指定した鼓動のリズム！

        // ★ フェーズ2追加：音響解析用プロパティ
        this.analyser = null;
        this.dataArray = null;
        this.audioLevel = 0; 
        this.bassLevel = 0;
        this.isMicActive = false;
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
            if (window.HapticEngine) HapticEngine.playTap(); // 起動時のスイッチ感触
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
            
            // 153bpmの物理的な鼓動（スマホがトクン…と震える）
            if (window.HapticEngine) HapticEngine.playPulse();

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
        if (window.HapticEngine) HapticEngine.playSpawn(); // 生成時のトトッという感触
    }

    // 🎒 星を消した時・亜空間へ送った時の音（低く吸い込まれる音）
    playDelete() {
        if (this.isMuted) return;
        this.playSystemSound(200, 'sawtooth', 0.2, 50);
        if (window.HapticEngine) HapticEngine.playDelete(); // 消去時のズンッという重い感触
    }

    // 🌌 ワープ（階層移動）した時の音
    playWarp() {
        if (this.isMuted) return;
        this.playSystemSound(400, 'triangle', 0.3, 800);
        if (window.HapticEngine) HapticEngine.playWarp(); // ワープ時のダダダダッという感触
    }

    // 汎用的なシンセサイザー発音機
    playSystemSound(startFreq, type, durationSec, endFreq = null) {
        // durationがミリ秒で渡された場合の安全策
        const dur = durationSec > 10 ? durationSec / 1000 : durationSec;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        
        osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
        if (endFreq) {
            osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + dur);
        }
        
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime); // 全体的なボリューム
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + dur);
    }

    // ★ フェーズ2追加：マイク・スピーカーの音響を取り込む特異点プロトコル
    async startMic() {
        if (this.isMicActive) return true;
        try {
            if (this.ctx.state === 'suspended') await this.ctx.resume();
            
            // マイク（またはシステム音声）のストリームを取得
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            const source = this.ctx.createMediaStreamSource(stream);
            
            // 周波数解析ノードの作成
            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 128; // 低音〜高音の解像度
            source.connect(this.analyser);
            
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.isMicActive = true;
            this.updateAudioLevel();
            
            console.log("🎙️ [AudioCore] 環境音響シンクロ・マトリクス起動");
            return true;
        } catch (err) {
            console.error("Mic access denied:", err);
            return false;
        }
    }

    updateAudioLevel() {
        if (!this.analyser) return;
        requestAnimationFrame(() => this.updateAudioLevel());
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // 全体の音量レベルを計算
        let sum = 0;
        for(let i = 0; i < this.dataArray.length; i++) sum += this.dataArray[i];
        this.audioLevel = (sum / this.dataArray.length) / 255.0; 

        // 低音域（キックドラムや声の響き）だけを抽出して衝撃波にする
        let bassSum = 0;
        for(let i = 0; i < 4; i++) bassSum += this.dataArray[i];
        this.bassLevel = (bassSum / 4) / 255.0;
    }
}