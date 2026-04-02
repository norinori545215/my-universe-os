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

        this.nodeDataMap = new Map(); 
        this.linksGroup = new THREE.Group();
        this.scene.add(this.linksGroup);

        this.createStarfield();

        // ★ 新規追加: レーザー判定（Raycaster）の準備
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // ウィンドウリサイズとマウスクリックのイベントを登録
        this.resizeHandler = () => this.resize();
        window.addEventListener('resize', this.resizeHandler);
        
        this.clickHandler = (e) => this.onClick(e);
        window.addEventListener('click', this.clickHandler);

        this.initUniverse();
        this.animate();
    }

    // テキスト看板の生成
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

    // 360度の星屑
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

    // ★ 新規追加: 星を「超カッコいいエネルギー体」として生成する関数
    createStarMesh(node, size, threeColor) {
        const group = new THREE.Group();
        group.userData.node = node; // 判定用にデータを埋め込む
        const isGhost = !!node.isGhost;

        // 1. コア（高密度な中心核）
        const coreGeo = new THREE.SphereGeometry(size, 32, 32);
        const coreMat = new THREE.MeshPhysicalMaterial({
            color: threeColor, emissive: threeColor, emissiveIntensity: isGhost ? 0.2 : 0.8,
            roughness: 0.2, metalness: 0.8, transparent: true, opacity: isGhost ? 0.3 : 0.95
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.userData.node = node;
        group.add(core);

        // 2. ホログラム・ワイヤーフレーム（デジタルな骨格）
        const wireGeo = new THREE.SphereGeometry(size * 1.15, 16, 16);
        const wireMat = new THREE.MeshBasicMaterial({
            color: threeColor, wireframe: true, transparent: true, opacity: 0.3,
            blending: THREE.AdditiveBlending // 光を重ねて輝かせる
        });
        const wire = new THREE.Mesh(wireGeo, wireMat);
        wire.userData.node = node;
        group.add(wire);

        // 3. グロー（オーラのような発光）
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

    initUniverse() {
        if (!this.currentUniverse || !this.currentUniverse.nodes) return;

        this.currentUniverse.nodes.forEach(node => {
            let nodeColor = node.color || '#00ffcc';
            let threeColor;
            try { threeColor = new THREE.Color(nodeColor); } catch(e) { threeColor = new THREE.Color(0x00ffcc); }

            const size = (node.size || 20) * 0.6;
            
            // ★ カッコいい星を生成
            const starObj = this.createStarMesh(node, size, threeColor);

            if (node.z === undefined) node.z = (Math.random() - 0.5) * 200; 
            const posX = node.x || 0;
            const posY = -(node.y || 0); 
            const posZ = node.z;

            starObj.group.position.set(posX, posY, posZ);

            const label = this.createTextSprite(node.name, nodeColor);
            label.position.set(0, size + 15, 0); 
            label.userData.node = node;
            starObj.group.add(label);

            this.scene.add(starObj.group);
            this.nodeDataMap.set(node, starObj);
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

    // ★ 新規追加: マウスクリック時に「視線（Ray）」を飛ばして星に触れる処理
    onClick(event) {
        if (!this.isActive) return;
        // UI（メニューなど）をクリックした時は反応させない
        if (event.target !== this.canvas) return;

        // マウス座標を -1.0 〜 +1.0 の3Dスクリーン座標に変換
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // カメラ位置からクリックした方向へ光線を飛ばす
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // 星（シーン内のオブジェクト）とぶつかったか判定
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        let clickedNode = null;
        for (let i = 0; i < intersects.length; i++) {
            let obj = intersects[i].object;
            // ぶつかったパーツ（コアやワイヤー）から、親の「星データ」を遡って探す
            while(obj && !obj.userData.node) { obj = obj.parent; }
            if (obj && obj.userData.node) {
                clickedNode = obj.userData.node;
                break;
            }
        }

        if (clickedNode) {
            // 星に触れた！
            if(window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1);
            // 2Dの時と全く同じUIメニューをその座標に開く
            this.app.ui.showMenu(clickedNode, event.clientX, event.clientY);
        } else {
            // 何もない宇宙空間をクリックしたらメニューを閉じる
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

        // 星のコアとワイヤーを別々のスピードで回転させる（超カッコいい演出）
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
        // ★ イベントリスナーを外す（バグ防止）
        window.removeEventListener('click', this.clickHandler);
        this.renderer.dispose();
        this.canvas.remove();
    }
}