// src/engine/Hyper3D.js
import * as THREE from 'https://esm.sh/three';
import { OrbitControls } from 'https://esm.sh/three/addons/controls/OrbitControls.js';

export class Hyper3D {
    constructor(app) {
        this.app = app;
        this.currentUniverse = app.currentUniverse;
        this.isActive = true;

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'hyper3d-canvas';
        this.canvas.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; z-index:5; pointer-events:auto;';
        document.body.appendChild(this.canvas);

        // 1. より深い宇宙の霧（フォグ）
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x020205, 0.0015); 

        // 2. カメラを空間の「中」に配置
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.camera.position.set(0, 0, 400); // 少し引いた位置からスタート

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x020205, 1); // 背景をより深淵な黒に

        // 3. コントロール（パン＝平行移動を許可して、宇宙を自由に移動できるようにする）
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enablePan = true; // 右クリックで宇宙空間を移動できる
        this.controls.autoRotate = true; 
        this.controls.autoRotateSpeed = 0.2; // 漂うようにゆっくり回る

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambientLight);
        const mainLight = new THREE.PointLight(0x00ffcc, 2, 2000);
        mainLight.position.set(0, 0, 0);
        this.scene.add(mainLight);

        this.meshMap = new Map();
        this.linksGroup = new THREE.Group();
        this.scene.add(this.linksGroup);

        // ★ 新規：360度全天球の星屑（スターフィールド）を生成
        this.createStarfield();

        this.resizeHandler = () => this.resize();
        window.addEventListener('resize', this.resizeHandler);

        this.initUniverse();
        this.animate();
    }

    // ★ 圧倒的な空間の広がりを作るスターフィールド（背景の星々）
    createStarfield() {
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 3000; // 3000個の星屑
        const starVertices = [];
        
        for (let i = 0; i < starCount; i++) {
            // 360度、全方向に数千の距離でランダムに星を散りばめる
            const x = (Math.random() - 0.5) * 4000;
            const y = (Math.random() - 0.5) * 4000;
            const z = (Math.random() - 0.5) * 4000;
            starVertices.push(x, y, z);
        }
        
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, transparent: true, opacity: 0.6 });
        this.starfield = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.starfield);
    }

initUniverse() {
        if (!this.currentUniverse || !this.currentUniverse.nodes) return;

        const sphereGeo = new THREE.SphereGeometry(1, 32, 32);

        this.currentUniverse.nodes.forEach(node => {
            // !! で強制的に true/false に変換
            const isGhost = !!node.isGhost; 
            const colorHex = parseInt((node.color || '#00ffcc').replace('#', '0x'), 16);

            const material = new THREE.MeshPhysicalMaterial({
                color: colorHex,
                emissive: colorHex,
                emissiveIntensity: 0.6,
                metalness: 0.9,
                roughness: 0.1,
                transparent: true,
                opacity: isGhost ? 0.3 : 0.9,
                wireframe: isGhost
            });

            // ★★★ 先ほど私が誤って消してしまった、最重要の1行を復活！ ★★★
            const mesh = new THREE.Mesh(sphereGeo, material);

            // 一度決めたZ座標はnodeに保存し、2Dに戻っても消えないようにする
            if (node.z === undefined) {
                node.z = (Math.random() - 0.5) * 1500; // 前後に1500の超・奥行きをランダム生成
            }

            const posX = node.x || 0;
            const posY = -(node.y || 0); 
            const posZ = node.z;

            mesh.position.set(posX, posY, posZ);
            
            const size = (node.size || 20) * 0.4;
            mesh.scale.set(size, size, size);

            this.scene.add(mesh);
            this.meshMap.set(node, mesh);
        });

        const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.2 });
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

        const bpm = 153;
        const msPerBeat = 60000 / (bpm / 2);
        const beatPhase = (Date.now() % msPerBeat) / msPerBeat;
        const pulse = Math.pow(Math.sin(beatPhase * Math.PI), 2);

        this.meshMap.forEach((mesh) => {
            mesh.rotation.y += 0.005;
            mesh.material.emissiveIntensity = 0.3 + (pulse * 0.7);
        });

        // スターフィールドもゆっくり回転させて広がりを出す
        if (this.starfield) {
            this.starfield.rotation.y += 0.0005;
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        this.isActive = false;
        window.removeEventListener('resize', this.resizeHandler);
        this.renderer.dispose();
        this.canvas.remove();
    }
}