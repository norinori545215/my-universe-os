import { CanvasBuilder } from './engine/CanvasBuilder.js';

window.addEventListener('DOMContentLoaded', () => {
    console.log("マルチバース・エンジン起動...");
    new CanvasBuilder('universe-canvas');
});