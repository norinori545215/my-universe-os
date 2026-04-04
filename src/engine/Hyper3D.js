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
        // パライバトルマリンのネオンブルーを際立たせるための漆黒
        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.FogExp2(0x000000, 0.0003); 

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20000);
        
        const startX = -this.app.camera.x;
        const startY = this.app.camera.y; 
        this.camera.position.set(startX, startY, 500); 

        // 屈折と透過を美しく見せるためのアンチエイリアスON
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

        // ★パライバトルマリンのネオン発光を際立たせる照明★
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.05); // 環境光はほぼゼロ
        this.scene.add(ambientLight);
        
        // 表面の艶（クリアコート）を反射させるためのDirectionalLight
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(-1000, 2000, 1000);
        this.scene.add(directionalLight);

        // カメラライト（表面の「艶」を表現）
        const cameraLight = new THREE.PointLight(0xffffff, 0.5, 2000);
        this.camera.add(cameraLight);
        this.scene.add(this.camera);

        this.nodeDataMap = new Map(); 
        this.linksGroup = new THREE.Group();
        this.scene.add(this.linksGroup);
        
        // リンク線（ネビュラブルー）
        this.lineMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending });

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
        
        ctx.fillStyle = 'rgba(125, 249, 255, 0.7)'; // パライバブルーのテキスト
        ctx.font = '28px serif';
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
            if(rand > 0.8) { b = 1.0; r = 0.0; g = 1.0; } // シアン系の星
            else if(rand > 0.6) { r = 0.5; g = 1.0; b = 1.0; } // ミントグリーンの星
            else { r = 0.5; g = 0.5; b = 0.5; } // わずかに暗い星

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

    // ★ パライバトルマリン生成メソッド ★
    createStarMesh(node, size, threeColor, isGhost) {
        const group = new THREE.Group();
        group.userData.node = node; 

        // 1. クリスタルの形状（前回の尖った多面体を維持）
        const coreGeo = new THREE.OctahedronGeometry(1, 0); 
        coreGeo.scale(1.0, 1.8, 1.0); 

        // 2. ★パライバトルマリン・ネオンマテリアル（MeshPhysicalMaterial）★
        // FF的な透過・屈折を維持しつつ、ネオン発光と色をパライバに強制補正
        const coreMat = new THREE.MeshPhysicalMaterial({
            // ★パライバトルマリンのエレクトリックブルー（シアンベースに強制変換）★
            // threeColor（node.color）を使用せず、内部でパライバ色を生成
            color: new THREE.Color(0x00FFFF), // ベースはシアン
            
            // ★ネオン発光（Emissive）を大幅に強化★
            emissive: new THREE.Color(0x7DF9FF), // ミントグリーンを混ぜてネオン管のように
            emissiveIntensity: isGhost ? 0.2 : 0.8, // 強烈に自ら発光させる
            
            metalness: 0.1, 
            roughness: 0.02, // 表面を極限まで滑らかに
            
            // クリアコート（表面のガラスのような艶）
            clearcoat: 1.0, // MAX
            clearcoatRoughness: 0.05,

            // 透過・屈折
            transmission: 1.0, // 完全に透き通らせる
            thickness: size * 1.5,
            ior: 1.62, // ★パライバトルマリンの屈折率

            // 遊色（虹彩）はネオン感を邪魔しないよう弱めるか、パライバの緑系に寄せる
            iridescence: 0.5, 
            iridescenceIOR: 1.2,
            iridescenceThicknessRange: [100, 300],

            transparent: true, 
            opacity: isGhost ? 0.3 : 1.0,
            depthWrite: true 
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.scale.set(size, size, size);
        core.userData.node = node;
        group.add(core);
        group.userData.core = core; // アニメーション用に記録

        // 3. ★内部のエレクトリック・ネオン光源（PointLight）★
        // クリスタル内部から強力なネオンブルーの光を放つ
        const innerLight = new THREE.PointLight(0x00FFFF, isGhost ? 1.0 : 5.0, size * 25);
        innerLight.position.set(0, 0, 0); // クリスタルの中心
        group.add(innerLight);
        group.userData.innerLight = innerLight; // アニメーション用に記録

        // 4. ★パライバブルーの後光（Glow）★
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = 128; glowCanvas.height = 128;
        const ctx = glowCanvas.getContext('2d');
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        // 中心は白、外側に向かってネオンブルーへ
        grad.addColorStop(0, 'rgba(255,255,255,1.0)'); 
        grad.addColorStop(0.2, 'rgba(0,255,255,0.8)'); // 純粋なシアン
        grad.addColorStop(0.5, 'rgba(125,249,255,0.2)'); // ミントグリーン
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.fillRect(0,0,128,128);
        
        const glowTex = new THREE.CanvasTexture(glowCanvas);
        const glowMat = new THREE.SpriteMaterial({ 
            map: glowTex, 
            color: 0x00FFFF, // 後光の色をネオンブルーに固定
            transparent: true, 
            blending: THREE.AdditiveBlending, 
            opacity: isGhost ? 0.1 : 0.7,
            depthWrite: false
        });
        const glow = new THREE.Sprite(glowMat);
        // 後光はクリスタルよりも大きく、優しく包むように
        glow.scale.set(size * 10, size * 10, 1);
        group.add(glow);
        group.userData.glow = glow; // アニメーション用に記録

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
            this.draggedLight = this.draggedGroup.userData.innerLight; // 内部ライトもドラッグ
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
                // 内部ライトも同期
                if (this.draggedLight) {
                    this.draggedLight.position.copy(intersectPoint);
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
        
        if (this.draggedNode) {
            this.controls.enabled = true; this.app.grabbedNode = null;
            if (this.hasMoved) { this.app.autoSave(); } 
            else { if(window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1); this.app.ui.showMenu(this.draggedNode, event.clientX, event.clientY); }
            this.draggedNode = null; this.draggedGroup = null; this.draggedLight = null;
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
            // パライバトルマリン感を出すため、UIManagerの色設定（node.color）を無視し、
            // 内部でネオンブルー（シアン：0x00FFFF）に固定する。
            // ユーザーが何色を指定しても、パライバトルマリン色になる。
            const nodeColor = '#00FFFF'; // 強制シアン
            const isGhost = !!node.isGhost;
            const size = (node.size || 20) * 0.8;

            let threeColor = new THREE.Color(0x00FFFF); // 強制シアン

            if (!data) {
                data = this.createStarMesh(node, size, threeColor, isGhost);
                if (node.z === undefined || Math.abs(node.z) > 1000) node.z = (Math.random() - 0.5) * 400;

                const label = this.createTextSprite(node.name);
                label.position.set(0, size * 2.5 + 10, 0);
                label.userData.node = node; label.userData.lastName = node.name;
                data.group.add(label);
                data.label = label;

                const targetX = node.x || 0; const targetY = -(node.y || 0); const targetZ = node.z || 0;
                data.group.position.set(targetX, targetY, targetZ);

                this.scene.add(data.group);
                this.nodeDataMap.set(node, data);
            } else {
                // UIManagerから色が変更されても、パライバ色（シアン）を維持
                
                // サイズと色の同期（強制シアン）
                data.group.userData.core.scale.set(size, size, size);
                data.group.userData.glow.scale.set(size * 10, size * 10, 1); 
                
                // マテリアルカラー、エミッシブカラー、Glowカラー、PointLightカラーを
                // すべてパライバ色（シアン〜ミントブルー）に強制
                data.group.userData.core.material.color.set(0x00FFFF); // シアン
                data.group.userData.core.material.emissive.set(0x7DF9FF); // ミントブルー（ネオン感）
                data.group.userData.glow.material.color.set(0x00FFFF); // 後光もシアン
                
                // 内部ライトもパライバ色（シアン）に強制し、強さを同期
                const innerLight = data.group.userData.innerLight;
                if (innerLight) {
                    innerLight.color.set(0x00FFFF); // シアン
                    innerLight.intensity = isGhost ? 1.0 : 5.0; // 強烈な発光
                }

                data.group.userData.core.material.opacity = isGhost ? 0.3 : 1.0;
                data.group.userData.glow.material.opacity = isGhost ? 0.1 : 0.7;
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
                // クリスタルの自転（ゆっくりと）
                data.group.userData.core.rotation.y += 0.003;
                data.group.userData.core.rotation.z += 0.001;
                
                // パライバ・エレクトリック・浮遊アニメーション（上下にゆっくりと鼓動）
                const bpm = 153;
                const msPerBeat = 60000 / (bpm / 2);
                const beatPhase = (Date.now() % msPerBeat) / msPerBeat;
                const pulse = Math.pow(Math.sin(beatPhase * Math.PI), 2);
                
                // 内部光源（PointLight）の強度も、鼓動に合わせてネオン管のように明滅させる
                if (data.group.userData.innerLight) {
                    const isGhost = !!data.group.userData.node.isGhost;
                    const baseIntensity = isGhost ? 1.0 : 5.0;
                    data.group.userData.innerLight.intensity = baseIntensity + (pulse * baseIntensity * 0.2); // 20%の範囲で明滅
                }

                const baseZ = data.group.userData.node.z || 0;
                const fluctuateZ = baseZ + (Math.sin(Date.now() * 0.001 + data.group.position.x) * 5); // 浮遊
                data.group.position.z = fluctuateZ;
                
                // 後光（Glow）の瞬きも鼓動と同期
                if (data.group.userData.glow) {
                    const baseScale = (data.group.userData.node.size || 20) * 0.8 * 10;
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
        
        if(this.scene.background) this.scene.background.dispose();
        
        this.renderer.dispose();
        this.canvas.remove();
    }
}