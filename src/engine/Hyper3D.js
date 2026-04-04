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

        // ★ アップデート1: 靄（フォグ）を完全に削除し、クリアな深淵を目指す
        this.scene.fog = null; 

        // ★ アップデート2: 美しい星雲（ネビュラ）の背景テクスチャを追加
        this.createNebulaBackground();

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20000); // 遠くまで見えるように遠点を拡張
        
        const startX = -this.app.camera.x;
        const startY = this.app.camera.y; 
        this.camera.position.set(startX, startY, 500); // 初期位置を少し引いて、全体を見渡しやすく

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        // 背景は星雲テクスチャが担うため、クリアカラーは漆黒に
        this.renderer.setClearColor(0x000000, 1); 

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enablePan = true; 
        this.controls.autoRotate = false; 
        this.controls.target.set(startX, startY, 0); 
        this.controls.minDistance = 50; // 近づきすぎ防止
        this.controls.maxDistance = 5000; // 遠ざかりすぎ防止

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); // 環境光を抑えて、星自体の発光を際立たせる
        this.scene.add(ambientLight);
        // 星々を照らす、わずかに青みがかった主光源
        const mainLight = new THREE.PointLight(0xaaccff, 1.5, 5000);
        mainLight.position.set(startX, startY, 1000); 
        this.scene.add(mainLight);

        this.nodeDataMap = new Map(); 
        this.linksGroup = new THREE.Group();
        this.scene.add(this.linksGroup);
        // リンク線も、よりサイバーで綺麗な青緑に
        this.lineMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.2 });

        this.createStarfield();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.isPointerDown = false;
        this.hasMoved = false;
        this.pointerDownPos = { x: 0, y: 0 };
        this.draggedNode = null;
        this.draggedGroup = null;
        this.dragPlane = new THREE.Plane(); 
        
        this.isDiving = false;
        this.diveTarget = new THREE.Vector3();

        this.resizeHandler = () => this.resize();
        window.addEventListener('resize', this.resizeHandler);
        
        this.pointerDown = (e) => this.onPointerDown(e);
        this.pointerMove = (e) => this.onPointerMove(e);
        this.pointerUp = (e) => this.onPointerUp(e);
        
        window.addEventListener('pointerdown', this.pointerDown);
        window.addEventListener('pointermove', this.pointerMove);
        window.addEventListener('pointerup', this.pointerUp);

        this.syncNodes(); 
        this.animate();
    }

    // ★ 新規追加: 美しい星雲の背景（スカイボックスの簡易版）を作成
    createNebulaBackground() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        // 漆黒のベース
        ctx.fillStyle = '#000000'; ctx.fillRect(0,0,1024,1024);
        
        // ランダムな星雲を描画
        for(let i=0; i<5; i++) {
            const x = Math.random() * 1024; const y = Math.random() * 1024;
            const radius = 200 + Math.random() * 300;
            const grd = ctx.createRadialGradient(x, y, 0, x, y, radius);
            const hue = Math.random() * 360;
            grd.addColorStop(0, `hsla(${hue}, 100%, 10%, 0.2)`); // 深く薄い色
            grd.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
            ctx.fillStyle = grd; ctx.fillRect(0, 0, 1024, 1024);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.background = texture;
    }

    createTextSprite(text, colorStr) {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.shadowColor = colorStr || '#00ffcc';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
        const starColors = [];
        for (let i = 0; i < 5000; i++) { // 星屑を5000に増やして、広大さを表現
            starVertices.push((Math.random() - 0.5) * 10000, (Math.random() - 0.5) * 10000, (Math.random() - 0.5) * 10000);
            
            // ★ アップデート3: 星屑にわずかな色彩（白、青、黄、赤）を与える
            const r = 0.8 + Math.random() * 0.2;
            const g = 0.8 + Math.random() * 0.2;
            const b = 0.8 + Math.random() * 0.2;
            if(Math.random() > 0.9) { // 10%の確率で色を偏らせる
                const type = Math.random();
                if(type < 0.4) { starColors.push(r*0.7, g*0.7, b); } // 青白い
                else if(type < 0.8) { starColors.push(r, g, b*0.7); } // 黄色っぽい
                else { starColors.push(r, g*0.7, b*0.7); } // 赤っぽい
            } else {
                starColors.push(r, g, b); // ほぼ白
            }
        }
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
        
        // ★ 修正: vertexColorsを有効にし、PointsMaterial自体にテクスチャ（丸い点）を適用
        const starMaterial = new THREE.PointsMaterial({ size: 2.5, vertexColors: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending });
        // 丸い点のテクスチャを作成して適用（靄を減らすためシャープに）
        const dotCanvas = document.createElement('canvas');
        dotCanvas.width = 32; dotCanvas.height = 32;
        const dotCtx = dotCanvas.getContext('2d');
        dotCtx.fillStyle = '#ffffff'; dotCtx.beginPath(); dotCtx.arc(16, 16, 14, 0, Math.PI*2); dotCtx.fill();
        starMaterial.map = new THREE.CanvasTexture(dotCanvas);

        this.starfield = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.starfield);
    }

    // ★ 新規追加: 惑星のような渦巻きテクスチャを作成
    createPlanetTexture(colorStr) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // ベースカラー
        const color = new THREE.Color(colorStr);
        ctx.fillStyle = color.getStyle(); ctx.fillRect(0,0,256,256);
        
        // 渦巻き模様（ガス惑星風）
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.globalAlpha = 0.15;
        for(let i=0; i<30; i++) {
            ctx.beginPath();
            const y = Math.random() * 256;
            ctx.moveTo(0, y);
            for(let x=0; x<256; x+=10) {
                const wave = Math.sin(x * 0.05 + y * 0.1) * 5;
                ctx.lineTo(x, y + wave + (Math.random()-0.5)*2);
            }
            ctx.stroke();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping; // 横方向にループさせる
        return texture;
    }

    createStarMesh(node, size, threeColor, isGhost) {
        const group = new THREE.Group();
        group.userData.node = node; 

        // ★ アップデート4: のっぺりした球体をやめ、Planetテクスチャを貼り付けたリアルな惑星へ
        const coreGeo = new THREE.SphereGeometry(1, 32, 32);
        const planetTexture = this.createPlanetTexture(node.color);
        const coreMat = new THREE.MeshStandardMaterial({
            map: planetTexture,
            emissive: threeColor, emissiveIntensity: isGhost ? 0.2 : 0.6, // 自らも美しく光る
            roughness: 0.5, metalness: 0.2, transparent: true, opacity: isGhost ? 0.3 : 0.98
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.scale.set(size, size, size);
        core.userData.node = node;
        core.rotation.y = Math.random() * Math.PI * 2; // 初期回転をランダムに
        group.add(core);
        group.userData.core = core; // アニメーション用に記録

        // ワイヤーフレーム（ホログラム装甲）
        const wireGeo = new THREE.SphereGeometry(1.1, 16, 16);
        const wireMat = new THREE.MeshBasicMaterial({ color: threeColor, wireframe: true, transparent: true, opacity: isGhost ? 0.05 : 0.2, blending: THREE.AdditiveBlending });
        const wire = new THREE.Mesh(wireGeo, wireMat);
        wire.scale.set(size, size, size);
        wire.userData.node = node;
        group.add(wire);
        group.userData.wire = wire; // アニメーション用に記録

        // ★ アップデート5: 擬似オーラ（Glow）をより柔らかく、重層的に重ねて美しく
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = 128; glowCanvas.height = 128;
        const ctx = glowCanvas.getContext('2d');
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255,255,255,0.9)'); 
        grad.addColorStop(0.2, `rgba(${threeColor.r*255}, ${threeColor.g*255}, ${threeColor.b*255}, 0.7)`); 
        grad.addColorStop(0.5, `rgba(${threeColor.r*255}, ${threeColor.g*255}, ${threeColor.b*255}, 0.2)`); // 柔らかい広がりを追加
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.fillRect(0,0,128,128);
        const glowTex = new THREE.CanvasTexture(glowCanvas);
        // オーラ（Sprite）を2枚重ねて、深みを出す
        const glowMat1 = new THREE.SpriteMaterial({ map: glowTex, color: threeColor, transparent: true, blending: THREE.AdditiveBlending, opacity: isGhost ? 0.1 : 0.5 });
        const glow1 = new THREE.Sprite(glowMat1);
        glow1.scale.set(size * 3.5, size * 3.5, 1);
        glow1.userData.node = node;
        group.add(glow1);

        const glowMat2 = new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, opacity: isGhost ? 0.05 : 0.2 });
        const glow2 = new THREE.Sprite(glowMat2);
        glow2.scale.set(size * 5, size * 5, 1); // より大きく、白い光を重ねる
        glow2.userData.node = node;
        group.add(glow2);

        return { group };
    }

    applySphereFormation() {
        const nodes = this.currentUniverse.nodes;
        const count = nodes.length;
        if (count === 0) return;
        
        const radius = Math.max(200, count * 25); 
        const phi = Math.PI * (3 - Math.sqrt(5)); 
        
        nodes.forEach((node, i) => {
            const y = 1 - (i / (count - 1)) * 2; 
            const r = Math.sqrt(1 - y * y); 
            const theta = phi * i; 
            
            node.x = Math.cos(theta) * r * radius;
            node.y = -(y * radius); 
            node.z = Math.sin(theta) * r * radius;
            
            node.baseX = node.x;
            node.baseY = node.y;
        });
        this.app.autoSave();
    }

    onPointerDown(event) {
        if (!this.isActive || event.target !== this.canvas || this.isDiving) return;
        
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        let clickedNode = null;
        for (let i = 0; i < intersects.length; i++) {
            let obj = intersects[i].object;
            while(obj && !obj.userData.node) { obj = obj.parent; }
            if (obj && obj.userData.node) { clickedNode = obj.userData.node; break; }
        }

        this.isPointerDown = true;
        this.pointerDownPos = { x: event.clientX, y: event.clientY };
        this.hasMoved = false;

        if (clickedNode) {
            this.controls.enabled = false; 
            this.draggedNode = clickedNode;
            this.draggedGroup = this.nodeDataMap.get(clickedNode).group;
            this.app.grabbedNode = clickedNode; 
            
            const normal = new THREE.Vector3();
            this.camera.getWorldDirection(normal);
            normal.negate();
            this.dragPlane.setFromNormalAndCoplanarPoint(normal, this.draggedGroup.position);
        }
    }

    onPointerMove(event) {
        if (!this.isActive || this.isDiving) return;
        
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        if (this.isPointerDown) {
            const dx = event.clientX - this.pointerDownPos.x; const dy = event.clientY - this.pointerDownPos.y;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.hasMoved = true;
        }

        if (this.draggedNode && this.hasMoved) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersectPoint = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint);
            
            if (intersectPoint) {
                this.draggedGroup.position.copy(intersectPoint);
                this.draggedNode.baseX = intersectPoint.x;
                this.draggedNode.baseY = -intersectPoint.y;
                this.draggedNode.z = intersectPoint.z;
                this.draggedNode.x = this.draggedNode.baseX;
                this.draggedNode.y = this.draggedNode.baseY;
            }
        }
    }

    onPointerUp(event) {
        if (!this.isActive || this.isDiving) return;
        this.isPointerDown = false;

        if (this.app.isLinking && this.app.linkSourceNode) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.scene.children, true);
            let targetNode = null;
            for (let i = 0; i < intersects.length; i++) {
                let obj = intersects[i].object;
                while(obj && !obj.userData.node) { obj = obj.parent; }
                if (obj && obj.userData.node) { targetNode = obj.userData.node; break; }
            }
            if (targetNode && targetNode !== this.app.linkSourceNode) {
                const existingIndex = this.app.currentUniverse.links.findIndex(l => 
                    (l.source === this.app.linkSourceNode && l.target === targetNode) || (l.source === targetNode && l.target === this.app.linkSourceNode) ||
                    (l.source.id && l.source.id === this.app.linkSourceNode.id && l.target.id === targetNode.id) || (l.source.id && l.source.id === targetNode.id && l.target.id === this.app.linkSourceNode.id)
                );
                if (existingIndex !== -1) { this.app.currentUniverse.links.splice(existingIndex, 1); if(window.universeAudio) window.universeAudio.playSystemSound(300, 'square', 0.1); } 
                else { this.app.currentUniverse.addLink(this.app.linkSourceNode, targetNode); if(window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1); }
                this.app.autoSave();
            }
            this.app.isLinking = false; this.app.linkSourceNode = null; return;
        }
        
        if (this.draggedNode) {
            this.controls.enabled = true; this.app.grabbedNode = null;
            if (this.hasMoved) { this.app.autoSave(); } 
            else { if(window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1); this.app.ui.showMenu(this.draggedNode, event.clientX, event.clientY); }
            this.draggedNode = null; this.draggedGroup = null;
        } else {
            if (!this.hasMoved && event.target === this.canvas) {
                this.app.ui.hideMenu(); if (this.app.ui.hideQuickNote) this.app.ui.hideQuickNote();
            }
        }
        this.hasMoved = false;
    }

    syncNodes() {
        if (!this.currentUniverse) return;
        const currentNodes = this.currentUniverse.nodes;

        for (const [node, data] of this.nodeDataMap.entries()) {
            if (!currentNodes.includes(node)) {
                this.scene.remove(data.group);
                this.nodeDataMap.delete(node);
            }
        }

        currentNodes.forEach(node => {
            let data = this.nodeDataMap.get(node);
            let nodeColor = node.color || '#00ffcc';
            const isGhost = !!node.isGhost;
            const size = (node.size || 20) * 0.6;

            let threeColor;
            try { threeColor = new THREE.Color(nodeColor); } catch(e) { threeColor = new THREE.Color(0x00ffcc); }

            if (!data) {
                data = this.createStarMesh(node, size, threeColor, isGhost);
                if (node.z === undefined || Math.abs(node.z) > 1000) node.z = (Math.random() - 0.5) * 400;

                const label = this.createTextSprite(node.name, nodeColor);
                label.position.set(0, size + 15, 0);
                label.userData.node = node; label.userData.lastName = node.name;
                data.group.add(label);
                
                data.label = label; data.labelColor = nodeColor;

                const targetX = node.x || 0; const targetY = -(node.y || 0); const targetZ = node.z || 0;
                data.group.position.set(targetX, targetY, targetZ);

                this.scene.add(data.group);
                this.nodeDataMap.set(node, data);
            } else {
                // サイズと色、ゴースト状態の同期
                data.group.userData.core.scale.set(size, size, size);
                data.group.userData.wire.scale.set(size, size, size);
                // Glow（Sprite）のサイズ同期はGroupごと行われるため不要
                
                data.group.userData.core.material.color.copy(threeColor);
                data.group.userData.core.material.emissive.copy(threeColor);
                data.group.userData.wire.material.color.copy(threeColor);
                
                // ゴースト状態
                data.group.userData.core.material.opacity = isGhost ? 0.3 : 0.98;
                data.group.userData.wire.material.opacity = isGhost ? 0.05 : 0.2;
            }

            if (this.draggedNode !== node && this.app.grabbedNode !== node) {
                const targetX = node.x || 0;
                const targetY = -(node.y || 0); 
                const targetZ = node.z || 0;
                data.group.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.08); 
            }

            if (data.label && data.label.userData.lastName !== node.name) {
                data.group.remove(data.label);
                const newLabel = this.createTextSprite(node.name, nodeColor);
                newLabel.position.set(0, size + 15, 0);
                newLabel.userData.node = node; newLabel.userData.lastName = node.name;
                data.group.add(newLabel);
                data.label = newLabel; data.labelColor = nodeColor;
            }
        });

        while(this.linksGroup.children.length > 0) { 
            const child = this.linksGroup.children[0];
            child.geometry.dispose(); 
            this.linksGroup.remove(child); 
        }
        
        if (this.app.isLinking && this.app.linkSourceNode) {
            const sourceData = this.nodeDataMap.get(this.app.linkSourceNode);
            if (sourceData) {
                const distance = this.camera.position.distanceTo(sourceData.group.position);
                const mousePoint = new THREE.Vector3();
                this.raycaster.ray.at(distance, mousePoint);
                const points = [sourceData.group.position, mousePoint];
                const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
                const tempLine = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: 0xff00ff, dashSize: 5, gapSize: 5 }));
                tempLine.computeLineDistances();
                this.linksGroup.add(tempLine);
            }
        }

        this.currentUniverse.links.forEach(link => {
            const sourceNode = currentNodes.find(n => n === link.source || (n.id && n.id === link.source.id));
            const targetNode = currentNodes.find(n => n === link.target || (n.id && n.id === link.target.id));
            if (sourceNode && targetNode) {
                const sData = this.nodeDataMap.get(sourceNode);
                const tData = this.nodeDataMap.get(targetNode);
                if (sData && tData) {
                    const points = [sData.group.position, tData.group.position];
                    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(lineGeo, this.lineMat);
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

        if (this.app.isZoomingIn && this.app.diveTargetNode) {
            if (!this.isDiving) {
                this.controls.enabled = false; 
                this.isDiving = true;
                const targetData = this.nodeDataMap.get(this.app.diveTargetNode);
                this.diveTarget = targetData ? targetData.group.position.clone() : new THREE.Vector3(0,0,0);
            }
            
            this.camera.position.lerp(this.diveTarget, 0.08);
            this.controls.target.lerp(this.diveTarget, 0.08);

            // ダイブの最後、霧がないのでパッと切り替わるのを防ぐため、カメラを星の内部に突入させる
            if (this.camera.position.distanceTo(this.diveTarget) < 5) {
                this.app.universeHistory.push(this.app.currentUniverse);
                this.app.currentUniverse = this.app.targetUniverse;
                this.app.camera.reset();
                this.app.isZoomingIn = false;
                this.app.hasMovedNode = false;
                this.app.ui.updateBreadcrumbs();
                this.isDiving = false;
                this.app.diveTargetNode = null;
                this.controls.enabled = true;
            }
        }

        if (this.currentUniverse !== this.app.currentUniverse) {
            this.nodeDataMap.forEach(data => { this.scene.remove(data.group); });
            this.nodeDataMap.clear();
            this.currentUniverse = this.app.currentUniverse;
            
            const startX = -this.app.camera.x;
            const startY = this.app.camera.y;
            this.camera.position.set(startX, startY, 500); 
            this.controls.target.set(startX, startY, 0); 
        }

        const bpm = 153;
        const msPerBeat = 60000 / (bpm / 2);
        const beatPhase = (Date.now() % msPerBeat) / msPerBeat;
        const pulse = Math.pow(Math.sin(beatPhase * Math.PI), 2);

        this.syncNodes();

        this.nodeDataMap.forEach((data) => {
            // ★ 修正: 星のコア（惑星）とワイヤーフレームを自転させる
            if (data.group.userData.core) data.group.userData.core.rotation.y += 0.003; // ゆっくり自転
            if (data.group.userData.wire) {
                data.group.userData.wire.rotation.x -= 0.005;
                data.group.userData.wire.rotation.y -= 0.005;
            }
            // 鼓動による明るさの変化も、テクスチャがあるので控えめに
            if (data.group.userData.core) data.group.userData.core.material.emissiveIntensity = 0.4 + (pulse * 0.3);
        });

        // 背景の星屑もゆっくり回転させる
        if (this.starfield) {
            this.starfield.rotation.y += 0.0001;
            this.starfield.rotation.x += 0.00005;
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        this.isActive = false;
        window.removeEventListener('resize', this.resizeHandler);
        window.removeEventListener('pointerdown', this.pointerDown);
        window.removeEventListener('pointermove', this.pointerMove);
        window.removeEventListener('pointerup', this.pointerUp);
        
        if(this.scene.background) this.scene.background.dispose();
        
        this.renderer.dispose();
        this.canvas.remove();
    }
}