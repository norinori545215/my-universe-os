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

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
        
        // ★ 修正: カメラの初期位置を「2Dで見ていた場所」にピッタリ合わせる！
        const startX = -this.app.camera.x;
        const startY = this.app.camera.y; // 3DではY軸が逆
        this.camera.position.set(startX, startY, 400); 

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
        this.controls.target.set(startX, startY, 0); // 視線の中心も2Dに合わせる

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambientLight);
        const mainLight = new THREE.PointLight(0x00ffcc, 2, 2000);
        mainLight.position.set(startX, startY, 0); // 光源も現在地に持ってくる
        this.scene.add(mainLight);

        this.nodeDataMap = new Map(); 
        this.linksGroup = new THREE.Group();
        this.scene.add(this.linksGroup);

        this.createStarfield();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.resizeHandler = () => this.resize();
        window.addEventListener('resize', this.resizeHandler);
        
        this.clickHandler = (e) => this.onClick(e);
        window.addEventListener('click', this.clickHandler);

        this.syncNodes(); // 初回の星生成
        this.animate();
    }

    createTextSprite(text, colorStr) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
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
        sprite.scale.set(120, 30, 1); 
        return sprite;
    }

    createStarfield() {
        const starGeometry = new THREE.BufferGeometry();
        const starVertices = [];
        for (let i = 0; i < 3000; i++) {
            starVertices.push((Math.random() - 0.5) * 4000, (Math.random() - 0.5) * 4000, (Math.random() - 0.5) * 4000);
        }
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, transparent: true, opacity: 0.6 });
        this.starfield = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.starfield);
    }

    createStarMesh(node, size, threeColor) {
        const group = new THREE.Group();
        group.userData.node = node; 
        const isGhost = !!node.isGhost;

        const coreGeo = new THREE.SphereGeometry(size, 32, 32);
        const coreMat = new THREE.MeshPhysicalMaterial({
            color: threeColor, emissive: threeColor, emissiveIntensity: isGhost ? 0.2 : 0.8,
            roughness: 0.2, metalness: 0.8, transparent: true, opacity: isGhost ? 0.3 : 0.95
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.userData.node = node;
        group.add(core);

        const wireGeo = new THREE.SphereGeometry(size * 1.15, 16, 16);
        const wireMat = new THREE.MeshBasicMaterial({
            color: threeColor, wireframe: true, transparent: true, opacity: 0.3,
            blending: THREE.AdditiveBlending 
        });
        const wire = new THREE.Mesh(wireGeo, wireMat);
        wire.userData.node = node;
        group.add(wire);

        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = 128; glowCanvas.height = 128;
        const ctx = glowCanvas.getContext('2d');
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255,255,255,0.8)');
        grad.addColorStop(0.2, `rgba(${threeColor.r*255}, ${threeColor.g*255}, ${threeColor.b*255}, 0.8)`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.fillRect(0,0,128,128);
        
        const glowTex = new THREE.CanvasTexture(glowCanvas);
        const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: threeColor, transparent: true, blending: THREE.AdditiveBlending, opacity: isGhost ? 0.2 : 0.7 });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(size * 4, size * 4, 1);
        glow.userData.node = node;
        group.add(glow);

        return { group, core, wire, glow };
    }

    // ★ 新規搭載: 2Dと3Dのデータをリアルタイムに完全同期する最強エンジン
    syncNodes() {
        if (!this.currentUniverse) return;
        const currentNodes = this.currentUniverse.nodes;

        // 1. 削除された星を3D空間からも消滅させる
        for (const [node, data] of this.nodeDataMap.entries()) {
            if (!currentNodes.includes(node)) {
                this.scene.remove(data.group);
                this.nodeDataMap.delete(node);
            }
        }

        // 2. 新しい星の生成 ＆ 既存の星の位置・名前をリアルタイム更新
        currentNodes.forEach(node => {
            let data = this.nodeDataMap.get(node);
            let nodeColor = node.color || '#00ffcc';

            if (!data) {
                // まだ3D化されていない星があれば生成
                let threeColor;
                try { threeColor = new THREE.Color(nodeColor); } catch(e) { threeColor = new THREE.Color(0x00ffcc); }
                const size = (node.size || 20) * 0.6;
                
                data = this.createStarMesh(node, size, threeColor);
                if (node.z === undefined) node.z = (Math.random() - 0.5) * 200;

                const label = this.createTextSprite(node.name, nodeColor);
                label.position.set(0, size + 15, 0);
                label.userData.node = node;
                label.userData.lastName = node.name; // 名前変更の検知用
                data.group.add(label);
                
                data.label = label;
                data.labelColor = nodeColor;

                this.scene.add(data.group);
                this.nodeDataMap.set(node, data);
            }

            // 座標のリアルタイム同期（2Dエンジンで計算された軌道やフォーメーションを3Dへ適用）
            const targetX = node.x || 0;
            const targetY = -(node.y || 0); 
            const targetZ = node.z || 0;
            data.group.position.set(targetX, targetY, targetZ);

            // メニューから名前が変更されたら、即座に3Dの看板も書き換える
            if (data.label && data.label.userData.lastName !== node.name) {
                data.group.remove(data.label);
                const size = (node.size || 20) * 0.6;
                const newLabel = this.createTextSprite(node.name, data.labelColor);
                newLabel.position.set(0, size + 15, 0);
                newLabel.userData.node = node;
                newLabel.userData.lastName = node.name;
                data.group.add(newLabel);
                data.label = newLabel;
            }
        });

        // 3. リンク（繋がれた線）のリアルタイム同期
        while(this.linksGroup.children.length > 0) { 
            this.linksGroup.remove(this.linksGroup.children[0]); 
        }
        
        const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.3 });
        this.currentUniverse.links.forEach(link => {
            const sourceNode = currentNodes.find(n => n === link.source || (n.id && n.id === link.source.id));
            const targetNode = currentNodes.find(n => n === link.target || (n.id && n.id === link.target.id));
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

    onClick(event) {
        if (!this.isActive) return;
        if (event.target !== this.canvas) return;

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        let clickedNode = null;
        for (let i = 0; i < intersects.length; i++) {
            let obj = intersects[i].object;
            while(obj && !obj.userData.node) { obj = obj.parent; }
            if (obj && obj.userData.node) {
                clickedNode = obj.userData.node;
                break;
            }
        }

        if (clickedNode) {
            if(window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1);
            this.app.ui.showMenu(clickedNode, event.clientX, event.clientY);
        } else {
            this.app.ui.hideMenu();
            if (this.app.ui.hideQuickNote) this.app.ui.hideQuickNote();
        }
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

        // ★ 毎フレーム、2Dエンジンのデータを3Dに同期！
        this.syncNodes();

        this.nodeDataMap.forEach((data) => {
            if (data.core) data.core.rotation.y += 0.005;
            if (data.wire) {
                data.wire.rotation.x -= 0.008;
                data.wire.rotation.y -= 0.008;
            }
            if (data.core) data.core.material.emissiveIntensity = 0.3 + (pulse * 0.7);
            if (data.glow) data.glow.material.opacity = 0.4 + (pulse * 0.4);
        });

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
        window.removeEventListener('click', this.clickHandler);
        this.renderer.dispose();
        this.canvas.remove();
    }
}