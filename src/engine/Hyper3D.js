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

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x020205, 0.0015); 

        // カメラを少し近づけて星を見やすくする
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.camera.position.set(0, 0, 350); 

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x020205, 1); 

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enablePan = true; 
        this.controls.autoRotate = true; 
        this.controls.autoRotateSpeed = 0.2; 

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambientLight);
        const mainLight = new THREE.PointLight(0x00ffcc, 2, 2000);
        mainLight.position.set(0, 0, 0);
        this.scene.add(mainLight);

        // MeshとGroupを管理するマップに変更
        this.nodeDataMap = new Map(); 
        this.linksGroup = new THREE.Group();
        this.scene.add(this.linksGroup);

        this.createStarfield();

        this.resizeHandler = () => this.resize();
        window.addEventListener('resize', this.resizeHandler);

        this.initUniverse();
        this.animate();
    }

    // ★ 追加：Canvas APIを使って星の名前（テキスト）を3D空間の看板（Sprite）にする関数
    createTextSprite(text, colorStr) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // 文字が宇宙空間でも読みやすいように光る影（ネオン）をつける
        ctx.shadowColor = colorStr || '#00ffcc';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        // 3D空間上での看板のサイズ
        sprite.scale.set(120, 30, 1); 
        return sprite;
    }

    createStarfield() {
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 3000; 
        const starVertices = [];
        
        for (let i = 0; i < starCount; i++) {
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
            const isGhost = !!node.isGhost; 
            
            // 色の安全なパース（2Dで設定されたどんな色にも対応）
            let nodeColor = node.color || '#00ffcc';
            let threeColor;
            try {
                threeColor = new THREE.Color(nodeColor);
            } catch(e) {
                threeColor = new THREE.Color(0x00ffcc);
            }

            const material = new THREE.MeshPhysicalMaterial({
                color: threeColor,
                emissive: threeColor,
                emissiveIntensity: 0.6,
                metalness: 0.9,
                roughness: 0.1,
                transparent: true,
                opacity: isGhost ? 0.3 : 0.9,
                wireframe: isGhost
            });

            const mesh = new THREE.Mesh(sphereGeo, material);
            // 星のサイズを少し大きめに補正
            const size = (node.size || 20) * 0.6;
            mesh.scale.set(size, size, size);

            // ★ 修正：Z軸の広がりを ±100 に抑え、カメラの視界に確実に収める！
            if (node.z === undefined) {
                node.z = (Math.random() - 0.5) * 200; 
            }

            const posX = node.x || 0;
            const posY = -(node.y || 0); // 2Dキャンバスと3DのY軸は上下逆なので反転
            const posZ = node.z;

            // ★ 「星の球体」と「名前の看板」をまとめるグループを作成
            const group = new THREE.Group();
            group.position.set(posX, posY, posZ);
            group.add(mesh); // グループの中心に星を配置

            // ★ 2D時代の「星の名前」を看板として星の上にホログラム表示
            const label = this.createTextSprite(node.name, nodeColor);
            label.position.set(0, size + 15, 0); // 星の少し上に浮かせる
            group.add(label);

            this.scene.add(group);
            
            // リンク作成とアニメーション用にグループとメッシュを保存
            this.nodeDataMap.set(node, { group, mesh });
        });

        const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.3 });
        this.currentUniverse.links.forEach(link => {
            const sourceNode = this.currentUniverse.nodes.find(n => n === link.source || (n.id && n.id === link.source.id));
            const targetNode = this.currentUniverse.nodes.find(n => n === link.target || (n.id && n.id === link.target.id));
            
            if (sourceNode && targetNode) {
                const sData = this.nodeDataMap.get(sourceNode);
                const tData = this.nodeDataMap.get(targetNode);
                if (sData && tData) {
                    const points = [sData.group.position, tData.group.position];
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

        // 球体（星本体）だけを自転させる（テキストは常にこちらを向く）
        this.nodeDataMap.forEach((data) => {
            data.mesh.rotation.y += 0.005;
            data.mesh.rotation.z += 0.002;
            data.mesh.material.emissiveIntensity = 0.3 + (pulse * 0.7);
        });

        // 宇宙の背景（スターフィールド）もゆっくり回転
        if (this.starfield) {
            this.starfield.rotation.y += 0.0005;
            this.starfield.rotation.x += 0.0002;
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