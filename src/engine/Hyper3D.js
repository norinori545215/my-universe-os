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
        // 背景は完全な漆黒
        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.FogExp2(0x000000, 0.0003); 

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20000);
        
        let targetX = 0, targetY = 0;
        if (this.currentUniverse && this.currentUniverse.nodes.length > 0) {
            this.currentUniverse.nodes.forEach(n => { targetX += (n.x || 0); targetY += -(n.y || 0); });
            targetX /= this.currentUniverse.nodes.length; targetY /= this.currentUniverse.nodes.length;
        } else {
            targetX = -this.app.camera.x; targetY = this.app.camera.y;
        }

        this.camera.position.set(targetX, targetY, 600); 

        // 屈折を綺麗に見せるためアンチエイリアスをON
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enablePan = true; 
        this.controls.autoRotate = false; 
        this.controls.target.set(targetX, targetY, 0); 
        this.controls.minDistance = 20; 
        this.controls.maxDistance = 8000; 

        // ★ クリスタルの面（エッジ）を際立たせる照明設計 ★
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); 
        this.scene.add(ambientLight);
        
        // 屈折と反射を生み出すメインライト
        const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.0);
        dirLight1.position.set(1000, 2000, 1000);
        this.scene.add(dirLight1);

        // 影になりすぎるのを防ぐサブライト
        const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight2.position.set(-1000, -1000, -1000);
        this.scene.add(dirLight2);

        this.nodeDataMap = new Map(); 
        this.linksGroup = new THREE.Group();
        this.scene.add(this.linksGroup);
        
        // リンク線（マナの糸）
        this.lineMat = new THREE.LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });

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

    createTextSprite(text) {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; 
        ctx.font = '28px "Times New Roman", serif'; // FFを意識したセリフ体
        ctx.textAlign = 'center'; 
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(text, 256, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(100, 25, 1); 
        return sprite;
    }

    createStarfield() {
        const starGeo = new THREE.BufferGeometry();
        const count = 3000;
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
            size: 2.0, 
            map: new THREE.CanvasTexture(dotCanvas),
            vertexColors: true, 
            transparent: true, 
            opacity: 0.6, 
            depthWrite: false
        });

        this.starfield = new THREE.Points(starGeo, starMat);
        this.scene.add(this.starfield);
    }

    // ★ 究極の立体クリスタル生成メソッド ★
    createStarMesh(node, size, threeColor, isGhost) {
        const group = new THREE.Group();
        group.userData.node = node; 

        // ベース形状：正八面体（FFのセーブクリスタルの基本形）
        const crystalGeo = new THREE.OctahedronGeometry(1, 0); 
        
        // 1. 【外殻】完全なガラスの層
        // 内部を屈折して映し出し、表面はバキバキに光を反射する
        const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, // ガラス自体は無色
            transmission: 1.0, // 100%の透過（奥を透かして屈折させる）
            opacity: 1.0,
            transparent: true,
            roughness: 0.0, // 表面はツルツル
            metalness: 0.1,
            ior: 2.4, // ★屈折率（ダイヤモンド級。これにより中のコアが歪んで美しく見える）
            thickness: size * 2.0, // ガラスの厚み
            clearcoat: 1.0, // 表面のクリアな反射
            flatShading: true, // ★面ごとにカクカクさせる（立体の要）
            side: THREE.FrontSide
        });
        const glass = new THREE.Mesh(crystalGeo, glassMat);
        // 縦長に引き伸ばす
        glass.scale.set(size * 0.8, size * 2.2, size * 0.8);
        group.add(glass);

        // 2. 【内核】パライバトルマリン色に光るコア
        // ガラスの中に閉じ込められた魔力の源
        const coreMat = new THREE.MeshStandardMaterial({
            color: threeColor, 
            emissive: threeColor, // 色に合わせて発光
            emissiveIntensity: isGhost ? 0.2 : 2.0, // 強く光らせる
            roughness: 0.8,
            transparent: true,
            opacity: isGhost ? 0.2 : 0.9,
            flatShading: true
        });
        const core = new THREE.Mesh(crystalGeo, coreMat);
        // 外殻のガラスより一回り小さくする
        core.scale.set(size * 0.5, size * 1.6, size * 0.5);
        group.add(core);

        // 3. 【光源】周囲を照らす本物の光
        // クリスタル自体が光源となり、周囲のリンク線などを照らす
        const innerLight = new THREE.PointLight(threeColor, isGhost ? 0.5 : 2.0, size * 15);
        group.add(innerLight);

        // 4. サブクリスタル（根本に小さな破片を2つ追加して情報量を上げる）
        for (let i = 0; i < 2; i++) {
            const subGlass = new THREE.Mesh(crystalGeo, glassMat);
            const subCore = new THREE.Mesh(crystalGeo, coreMat);
            
            const s = size * 0.4;
            subGlass.scale.set(s * 0.8, s * 1.8, s * 0.8);
            subCore.scale.set(s * 0.5, s * 1.3, s * 0.5);
            
            const subGroup = new THREE.Group();
            subGroup.add(subGlass);
            subGroup.add(subCore);
            
            // 根本に斜めに突き刺す
            const angle = i * Math.PI;
            subGroup.position.set(Math.cos(angle) * size * 0.4, -size * 0.8, Math.sin(angle) * size * 0.4);
            subGroup.rotation.z = (i === 0) ? 0.5 : -0.5;
            subGroup.rotation.x = 0.3;
            
            group.add(subGroup);
        }

        // アニメーション・同期用に保存
        group.userData.glass = glass;
        group.userData.core = core;
        group.userData.innerLight = innerLight;

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
            let nodeColor = node.color || '#00f2f2'; // 初期値をパライバブルーに
            const isGhost = !!node.isGhost;
            // サイズ補正
            const size = (node.size || 20) * 0.7;

            let threeColor;
            try { threeColor = new THREE.Color(nodeColor); } catch(e) { threeColor = new THREE.Color(0x00f2f2); }

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
                // 色とサイズのリアルタイム同期
                data.group.userData.glass.scale.set(size * 0.8, size * 2.2, size * 0.8);
                data.group.userData.core.scale.set(size * 0.5, size * 1.6, size * 0.5);
                
                // コア（内側）の色を更新
                data.group.userData.core.material.color.copy(threeColor);
                data.group.userData.core.material.emissive.copy(threeColor);
                data.group.userData.core.material.opacity = isGhost ? 0.2 : 0.9;
                
                // サブクリスタルの色も一括更新
                data.group.children.forEach(child => {
                    if (child instanceof THREE.Group) {
                        child.children[1].material.color.copy(threeColor);
                        child.children[1].material.emissive.copy(threeColor);
                    }
                });

                // 内部ライトの更新
                if (data.group.userData.innerLight) {
                    data.group.userData.innerLight.color.copy(threeColor);
                    data.group.userData.innerLight.intensity = isGhost ? 0.5 : 2.0;
                }
            }

            if (this.draggedNode !== node && this.app.grabbedNode !== node) {
                const targetX = node.x || 0;
                const targetY = -(node.y || 0); 
                const targetZ = node.z || 0;
                data.group.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.08); 
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
                
                let nextX = 0, nextY = 0;
                if (this.app.currentUniverse.nodes.length > 0) {
                    this.app.currentUniverse.nodes.forEach(n => { nextX += (n.x || 0); nextY += -(n.y || 0); });
                    nextX /= this.app.currentUniverse.nodes.length;
                    nextY /= this.app.currentUniverse.nodes.length;
                }
                this.camera.position.set(nextX, nextY, 600);
                this.controls.target.set(nextX, nextY, 0);
            }
        }

        if (this.currentUniverse !== this.app.currentUniverse) {
            this.nodeDataMap.forEach(data => { this.scene.remove(data.group); });
            this.nodeDataMap.clear();
            this.currentUniverse = this.app.currentUniverse;
        }

        this.syncNodes();

        this.nodeDataMap.forEach((data) => {
            // クリスタル全体の自転（神聖さを出すためゆっくり）
            data.group.rotation.y += 0.002;
            
            // 浮遊アニメーション
            const baseZ = data.group.userData.node.z || 0;
            data.group.position.z = baseZ + (Math.sin(Date.now() * 0.001 + data.group.position.x) * 3); 
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