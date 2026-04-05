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
        // 宇宙の深淵（完全な漆黒）
        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.FogExp2(0x000000, 0.0003); // クリスタルの輝きを際立たせるための薄い闇

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20000);
        
        const startX = -this.app.camera.x;
        const startY = this.app.camera.y; 
        this.camera.position.set(startX, startY, 500); 

        // ★クリスタルの「パライバ的な輝き」を最大化するため、アンチエイリアスON、PixelRatioを高めに★
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enablePan = true; 
        this.controls.autoRotate = false; 
        this.controls.target.set(startX, startY, 0); 
        this.controls.minDistance = 20; 
        this.controls.maxDistance = 8000; 

        // ★パライバブルーの「透過」と「屈折」を美しく見せるための専用照明★
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.1); // 環境光（極めて暗く）
        this.scene.add(ambientLight);
        
        // 遠方からの強烈なDirectionalLight（クリスタルの表面で「虹色の反射」を作る）
        const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
        directionalLight.position.set(-1000, 2000, 1000);
        this.scene.add(directionalLight);

        // カメラライト（表面の「艶」を表現）
        const cameraLight = new THREE.PointLight(0xffffff, 1.0, 2000);
        this.camera.add(cameraLight);
        this.scene.add(this.camera);

        this.nodeDataMap = new Map(); 
        this.linksGroup = new THREE.Group();
        this.scene.add(this.linksGroup);
        
        // リンク線（繊細な光の糸）
        this.lineMat = new THREE.LineBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending });

        this.createStarfield();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.isPointerDown = false;
        this.hasMoved = false;
        this.pointerDownPos = { x: 0, y: 0 };
        this.draggedNode = null;
        this.draggedGroup = null;
        this.draggedLight = null;
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

    createTextSprite(text) {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // FF風の静寂なテキスト
        ctx.font = '28px "Times New Roman", serif'; // セリフ体でクラシックに
        ctx.textAlign = 'center'; 
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(100, 25, 1); 
        return sprite;
    }

    createStarfield() {
        const starGeo = new THREE.BufferGeometry();
        const count = 4000;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        for(let i=0; i<count; i++) {
            positions[i*3] = (Math.random() - 0.5) * 12000;
            positions[i*3+1] = (Math.random() - 0.5) * 12000;
            positions[i*3+2] = (Math.random() - 0.5) * 12000;
            
            const rand = Math.random();
            let r = 1, g = 1, b = 1;
            if(rand > 0.8) { b = 1.0; r = 0.8; g = 0.9; } 
            else if(rand > 0.6) { r = 1.0; g = 0.9; b = 0.7; } 
            else { r = 0.9; g = 0.9; b = 0.9; } 

            colors[i*3] = r; colors[i*3+1] = g; colors[i*3+2] = b;
        }

        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const dotCanvas = document.createElement('canvas');
        dotCanvas.width = 16; dotCanvas.height = 16;
        const dotCtx = dotCanvas.getContext('2d');
        dotCtx.beginPath(); dotCtx.arc(8, 8, 6, 0, Math.PI*2); dotCtx.fillStyle = '#fff'; dotCtx.fill();

        const starMat = new THREE.PointsMaterial({ 
            size: 2.5, 
            map: new THREE.CanvasTexture(dotCanvas),
            vertexColors: true, 
            transparent: true, 
            opacity: 0.7, 
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.starfield = new THREE.Points(starGeo, starMat);
        this.scene.add(this.starfield);
    }

    // ★FF的クリスタル生成メソッド - パライバトルマリン・エディション ★
    createStarMesh(node, size, threeColor, isGhost) {
        const group = new THREE.Group();
        group.userData.node = node; 

        // 1. クリスタルの形状（結晶原石：面数を増やして形状を複雑にする）
        const coreGeo = new THREE.OctahedronGeometry(1, 1); // 球体ではなく多面体。分割数を1にして面を増やす
        // 結晶らしく縦長に引き伸ばす
        coreGeo.scale(1.0, 1.8, 1.0); 

        // 2. ★究極のネニ・パライバ・マテリアル（透過、強い屈折、遊色効果）★
        // 後から色を変更できるように、色は threeColor を使用
        const coreMat = new THREE.MeshPhysicalMaterial({
            color: threeColor, // クリスタルの透過色
            emissive: threeColor, // 自らも光る（魔力の光源）
            emissiveIntensity: 0.2, // ネオン感を出すために少し強めに
            
            metalness: 0, // 金属ではない
            roughness: 0.0, // 表面を極限まで滑らかに（屈折のため）
            
            // ★Transmission (透過): これがクリスタルの正解
            transmission: 1.0, // 完全に透き通らせる
            thickness: size * 3, // 厚み（屈折効果に影響。パライバは厚めで）
            ior: 2.4, // ★屈折率（パライバのネオン輝きを出すため、ダイヤモンドに近い2.4に設定）

            // ★Iridescence (遊色効果): これがパライバの虹色の輝き
            iridescence: 1.0, // 表面に虹色の輝きを纏わせる
            iridescenceIOR: 1.5,
            iridescenceThicknessRange: [200, 600], // 青〜緑の虹色が出るように調整

            // ★Sheen (光沢): 表面の青白い光沢
            sheen: 0.5,
            sheenColor: new THREE.Color(0xccffff), // 青白い光沢

            clearcoat: 1.0, // 表面をガラスのようにコーティングして光を反射させる
            clearcoatRoughness: 0.0,

            transparent: true, 
            opacity: isGhost ? 0.3 : 1.0,
            depthWrite: true, // 透過同士の重なりを綺麗に見せる
            attenuationColor: threeColor, // ★光が減衰する際の色（重要）
            attenuationDistance: size * 5 // ★光が減衰する距離
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.scale.set(size, size, size);
        core.userData.node = node;
        core.rotation.y = Math.random() * Math.PI * 2; // 初期回転をランダムに
        group.add(core);
        group.userData.core = core; // アニメーション用に記録

        // 3. ★立体感を強調する：多面体の「エッジ（角）」だけを光らせる（エネルギー・ライン）★
        // これにより、透過しても多面体の形状がクッキリと分かる
        const edgesGeo = new THREE.EdgesGeometry(coreGeo);
        const edgesMat = new THREE.LineBasicMaterial({ 
            color: threeColor, // 色を設定色に
            transparent: true, 
            opacity: isGhost ? 0.1 : 0.4, 
            blending: THREE.AdditiveBlending,
            linewidth: 1 // 3D空間では極細
        });
        const edges = new THREE.LineSegments(edgesGeo, edgesMat);
        edges.scale.set(size, size, size);
        group.add(edges);
        group.userData.edges = edges; // 同期用に記録

        // 4. ★クリスタル内部のネオン光源（PointLight）★
        // クリスタル自体がネオン光を放ち、周囲を照らすようにする
        // 強度を高めてパライバのネオン感を強調
        const innerLight = new THREE.PointLight(threeColor, isGhost ? 0.8 : 3.0, size * 25);
        innerLight.position.set(0, 0, 0); // クリスタルの中心
        group.add(innerLight);
        group.userData.innerLight = innerLight; // 同期用に記録

        // 5. クリスタル全体を包む柔らかい虹色の後光（Glow）
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = 128; glowCanvas.height = 128;
        const ctx = glowCanvas.getContext('2d');
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        // 中心は白、外側に向かってネオンブルー〜虹色にグラデーション
        grad.addColorStop(0, 'rgba(255,255,255,0.9)'); 
        grad.addColorStop(0.2, `rgba(${threeColor.r*255}, ${threeColor.g*255}, ${threeColor.b*255}, 0.8)`); // パライバブルー
        grad.addColorStop(0.5, `hsla(180, 100%, 70%, 0.15)`); // ネオンブルーグリーンの広がり
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.fillRect(0,0,128,128);
        
        const glowTex = new THREE.CanvasTexture(glowCanvas);
        const glowMat = new THREE.SpriteMaterial({ 
            map: glowTex, 
            // 後光の色を設定色に合わせる（重要）
            transparent: true, 
            blending: THREE.AdditiveBlending, 
            opacity: isGhost ? 0.1 : 0.6,
            depthWrite: false
        });
        const glow = new THREE.Sprite(glowMat);
        // 後光はクリスタルよりも大きく、優しく包むように
        glow.scale.set(size * 12, size * 12, 1);
        group.add(glow);
        group.userData.glow = glow; // 同期用に記録

        return { group };
    }

    applySphereFormation() {
        const nodes = this.currentUniverse.nodes;
        const count = nodes.length;
        if (count === 0) return;
        
        const radius = Math.max(150, count * 20); 
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
            this.grabbedLight = this.draggedGroup.userData.innerLight; // 内部ライトもドラッグ
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
                // 内部ライトもドラッグ
                if (this.grabbedLight) {
                    this.grabbedLight.position.copy(intersectPoint);
                }
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
            this.draggedNode = null; this.draggedGroup = null; this.grabbedLight = null;
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
            let nodeColor = node.color || '#00f2f2'; // パライバブルーをデフォルトに
            const isGhost = !!node.isGhost;
            // クリスタル原石は球体より存在感を出すため、少し大きく設定
            const size = (node.size || 20) * 0.9;

            let threeColor;
            try { threeColor = new THREE.Color(nodeColor); } catch(e) { threeColor = new THREE.Color(0x00f2f2); }

            if (!data) {
                data = this.createStarMesh(node, size, threeColor, isGhost);
                if (node.z === undefined || Math.abs(node.z) > 1000) node.z = (Math.random() - 0.5) * 400;

                const label = this.createTextSprite(node.name);
                // セリフ体テキストは少し離す
                label.position.set(0, size * 2.5 + 10, 0);
                label.userData.node = node; label.userData.lastName = node.name;
                data.group.add(label);
                data.label = label;

                const targetX = node.x || 0; const targetY = -(node.y || 0); const targetZ = node.z || 0;
                data.group.position.set(targetX, targetY, targetZ);

                this.scene.add(data.group);
                this.nodeDataMap.set(node, data);
            } else {
                // ★色を後から設定できるように同期ロジックを強化★
                // サイズと色の同期
                data.group.userData.core.scale.set(size, size, size);
                data.group.userData.glow.scale.set(size * 12, size * 12, 1); 
                if (data.group.userData.edges) {
                    data.group.userData.edges.scale.set(size, size, size);
                }
                
                // マテリアルの色を更新（透過色、発光色、減衰色）
                data.group.userData.core.material.color.copy(threeColor);
                data.group.userData.core.material.emissive.copy(threeColor);
                data.group.userData.core.material.attenuationColor.copy(threeColor);
                // エッジ（エネルギー・ライン）の色も同期
                if (data.group.userData.edges) {
                    data.group.userData.edges.material.color.copy(threeColor);
                }
                // Glow（後光）の色も同期
                data.group.userData.glow.material.color.copy(threeColor); 
                
                // 内部ネオン光源も色と強さを同期
                const innerLight = data.group.userData.innerLight;
                if (innerLight) {
                    innerLight.color.copy(threeColor);
                    innerLight.intensity = isGhost ? 0.8 : 3.0;
                }

                data.group.userData.core.material.opacity = isGhost ? 0.3 : 1.0;
                if (data.group.userData.edges) {
                    data.group.userData.edges.material.opacity = isGhost ? 0.1 : 0.4;
                }
                data.group.userData.glow.material.opacity = isGhost ? 0.1 : 0.6;
            }

            if (this.draggedNode !== node && this.app.grabbedNode !== node) {
                const targetX = node.x || 0;
                const targetY = -(node.y || 0); 
                const targetZ = node.z || 0;
                data.group.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.08); 
                // 内部ライトもドラッグ中でなければグループに追従
                if (data.group.userData.innerLight) {
                    data.group.userData.innerLight.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.08);
                }
            }

            if (data.label && data.label.userData.lastName !== node.name) {
                data.group.remove(data.label);
                const newLabel = this.createTextSprite(node.name);
                newLabel.position.set(0, size * 2.5 + 10, 0);
                newLabel.userData.node = node; newLabel.userData.lastName = node.name;
                data.group.add(newLabel);
                data.label = newLabel;
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
                const tempLine = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 5, gapSize: 5 }));
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

        this.syncNodes();

        this.nodeDataMap.forEach((data) => {
            if (data.group.userData.core) {
                // ★クリスタルの自転（ゆっくりと）
                data.group.userData.core.rotation.y += 0.003;
                data.group.userData.core.rotation.z += 0.001;
                // エッジも同期して回転
                if (data.group.userData.edges) {
                    data.group.userData.edges.rotation.y += 0.003;
                    data.group.userData.edges.rotation.z += 0.001;
                }
                
                // ★クリスタルの浮遊アニメーション（上下にゆっくりと鼓動）
                const bpm = 153;
                const msPerBeat = 60000 / (bpm / 2);
                const beatPhase = (Date.now() % msPerBeat) / msPerBeat;
                const pulse = Math.pow(Math.sin(beatPhase * Math.PI), 2);
                
                const baseZ = data.group.userData.node.z || 0;
                const fluctuateZ = baseZ + (Math.sin(Date.now() * 0.001 + data.group.position.x) * 5); // 浮遊
                data.group.position.z = fluctuateZ;
                
                // ★内部ネオン光源の強さを鼓動と同期（パライバのネオン感）
                if (data.group.userData.innerLight) {
                    const baseIntensity = data.group.userData.node.isGhost ? 0.8 : 3.0;
                    // 鼓動で少しだけ強弱をつける
                    data.group.userData.innerLight.intensity = baseIntensity + (pulse * baseIntensity * 0.15);
                }

                // 後光（Glow）の瞬きも鼓動と同期
                if (data.group.userData.glow) {
                    const baseScale = (data.group.userData.node.size || 20) * 0.9 * 12;
                    const fluctuateGlow = baseScale + (pulse * baseScale * 0.1);
                    data.group.userData.glow.scale.set(fluctuateGlow, fluctuateGlow, 1);
                }
            }
        });

        if (this.starfield) {
            this.starfield.rotation.y += 0.0001;
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
        
        // ★修正: 背景が「画像（テクスチャ）」の場合のみ破棄するように安全対策！
        if(this.scene.background && this.scene.background.isTexture) {
            this.scene.background.dispose();
        }
        
        this.renderer.dispose();
        this.canvas.remove();
    }
}