// src/engine/Hyper3D.js
import * as THREE from 'three';
// ※もしビルドエラーが出る場合は、下のパスを 'three/examples/jsm/controls/OrbitControls.js' に変更してください
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Hyper3D {
    constructor(app) {
        this.app = app;
        this.currentUniverse = app.currentUniverse;
        this.isActive = true;

        // 1. 3D専用キャンバスの動的生成（2Dキャンバスの上に重ねる）
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'hyper3d-canvas';
        this.canvas.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; z-index:5; pointer-events:auto;';
        document.body.appendChild(this.canvas);

        // 2. シーン、カメラ、レンダラーの構築
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x05050a, 0.002); // 宇宙の果てを暗くフェードアウト

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);
        this.camera.position.set(0, 150, 400);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // スマホの高解像度対応
        this.renderer.setClearColor(0x05050a, 1);

        // 3. 空間コントロール（マウスドラッグでぐるぐる回せる）
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.autoRotate = true; // 放置すると宇宙全体がゆっくり回る
        this.controls.autoRotateSpeed = 0.5;

        // 4. 光源（サイバーパンク・ライティング）
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        this.scene.add(ambientLight);
        const mainLight = new THREE.PointLight(0x00ffcc, 2, 1000);
        mainLight.position.set(0, 0, 0);
        this.scene.add(mainLight);

        this.meshMap = new Map();
        this.linksGroup = new THREE.Group();
        this.scene.add(this.linksGroup);

        this.resizeHandler = () => this.resize();
        window.addEventListener('resize', this.resizeHandler);

        this.initUniverse();
        this.animate();
    }

    // 2Dのデータを完全な3D球体として配置する
    initUniverse() {
        if (!this.currentUniverse || !this.currentUniverse.nodes) return;

        const sphereGeo = new THREE.SphereGeometry(1, 32, 32);

        // 星（Node）の生成
        this.currentUniverse.nodes.forEach(node => {
            const isGhost = node.isGhost;
            const colorHex = parseInt((node.color || '#00ffcc').replace('#', '0x'), 16);

            // サイバーパンクな金属＋ネオンの質感
            const material = new THREE.MeshPhysicalMaterial({
                color: colorHex,
                emissive: colorHex,
                emissiveIntensity: 0.5,
                metalness: 0.8,
                roughness: 0.2,
                transparent: true,
                opacity: isGhost ? 0.3 : 0.9,
                wireframe: isGhost // 幽霊星はワイヤーフレームになる演出
            });

            const mesh = new THREE.Mesh(sphereGeo, material);
            
            // 2D座標(X, Y)を3D座標(X, Z)にマッピングし、Y軸(高さ)にランダムな揺らぎを与える
            const posX = node.x || (Math.random() - 0.5) * 200;
            const posZ = node.y || (Math.random() - 0.5) * 200;
            const posY = (Math.random() - 0.5) * 100;

            mesh.position.set(posX, posY, posZ);
            
            const size = (node.size || 20) * 0.4;
            mesh.scale.set(size, size, size);

            this.scene.add(mesh);
            this.meshMap.set(node, mesh);
        });

        // 星同士を繋ぐエネルギーライン（Link）の生成
        const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.3 });
        this.currentUniverse.links.forEach(link => {
            const sourceNode = this.currentUniverse.nodes.find(n => n === link.source || (n.id && n.id === link.source.id));
            const targetNode = this.currentUniverse.nodes.find(n => n === link.target || (n.id && n.id === link.target.id));
            
            if (sourceNode && targetNode) {
                const sMesh = this.meshMap.get(sourceNode);
                const tMesh = this.meshMap.get(targetNode);
                if (sMesh && tMesh) {
                    const points = [sMesh.position, tMesh.position];
                    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(lineGeo, lineMat);
                    this.linksGroup.add(line);
                }
            }
        });
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        if (!this.isActive) return;
        requestAnimationFrame(() => this.animate());

        // 153bpmパルス同期（BGMのキックに合わせて星が光る）
        const bpm = 153;
        const msPerBeat = 60000 / (bpm / 2);
        const beatPhase = (Date.now() % msPerBeat) / msPerBeat;
        const pulse = Math.pow(Math.sin(beatPhase * Math.PI), 2);

        // 全ての星を鼓動・自転させる
        this.meshMap.forEach((mesh) => {
            mesh.rotation.y += 0.005;
            mesh.material.emissiveIntensity = 0.2 + (pulse * 0.8);
        });

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    // 2Dに戻る時の完全破棄処理（メモリリーク防止）
    destroy() {
        this.isActive = false;
        window.removeEventListener('resize', this.resizeHandler);
        this.renderer.dispose();
        this.canvas.remove(); // DOMから完全に消去
    }
}