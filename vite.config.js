// vite.config.js
import { defineConfig } from 'vite';
import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator';

export default defineConfig({
  plugins: [
    obfuscatorPlugin({
      options: {
        compact: true, // コードを1行に圧縮
        controlFlowFlattening: true, // コードの処理の流れを複雑にして解読不能にする
        deadCodeInjection: true, // 意味のないダミーコードを混ぜ込む（罠）
        debugProtection: true, // F12(開発者ツール)を開くと無限ループでフリーズさせる
        disableConsoleOutput: true, // console.logの出力をすべて消す
        stringArray: true, // 文字列を暗号化リストに変換
        stringArrayEncoding: ['base64'], // 文字列をBase64で難読化
      }
    })
  ]
});