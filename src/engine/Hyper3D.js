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
        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.FogExp2(0x000000, 0.0003); 

        // ガラスの反射を美しく見せるための環境光マップ
        const envCanvas = document.createElement('canvas');
        envCanvas.width = 512; envCanvas.height = 256;
        const envCtx = envCanvas.getContext('2d');
        envCtx.fillStyle = '#000000'; envCtx.fillRect(0,0,512,256);
        for(let i=0; i<30; i++) {
            envCtx.beginPath();
            envCtx.arc(Math.random()*512, Math.random()*256, Math.random()*30+10, 0, Math.PI*2);
            envCtx.fillStyle = `hsla(${Math.random()*360}, 80%, 70%, 0.5)`; 
            envCtx.fill();
        }
        const envTex = new THREE.CanvasTexture(envCanvas);
        envTex.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.environment = envTex; 

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20000);
        
        let targetX = 0, targetY = 0;
        if (this.currentUniverse && this.currentUniverse.nodes.length > 0) {
            this.currentUniverse.nodes.forEach(n => { targetX += (n.x || 0); targetY += -(n.y || 0); });
            targetX /= this.currentUniverse.nodes.length; targetY /= this.currentUniverse.nodes.length;
        } else {
            targetX = -this.app.camera.x; targetY = this.app.camera.y;
        }

        this.camera.position.set(targetX, targetY, 600); 

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

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); 
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
        directionalLight.position.set(-1000, 2000, 1000);
        this.scene.add(directionalLight);

        const cameraLight = new THREE.PointLight(0xffffff, 1.2, 2000);
        this.camera.add(cameraLight);
        this.scene.add(this.camera);

        this.nodeDataMap = new Map(); 
        this.linksGroup = new THREE.Group();
        this.scene.add(this.linksGroup);
        
        // リンク線（星同士を繋ぐ線）は、邪魔にならないよう淡く細く
        this.lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending });

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
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; 
        ctx.font = '32px "Times New Roman", serif'; 
        ctx.textAlign = 'center'; 
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000000'; 
        ctx.shadowBlur = 6;
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

    createStarMesh(node, size, threeColor, isGhost) {
        const group = new THREE.Group();
        group.userData.node = node; 

        // クリスタル形状
        const coreGeo = new THREE.OctahedronGeometry(1, 1); 
        coreGeo.scale(1.0, 2.0, 1.0); 

        // ★ 安っぽい輪郭線（エッジ）を完全削除。純粋なガラスの反射と透過だけで見せる！ ★
        const coreMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, 
            emissive: threeColor, 
            emissiveIntensity: isGhost ? 0.2 : 0.9, // 線がない分、内側からの発光を少し強く
            
            metalness: 0.1, 
            roughness: 0.05, 
            
            transmission: 0.8, 
            thickness: size * 2.5, 
            ior: 2.2, 

            iridescence: 1.0, 
            iridescenceIOR: 1.5,
            iridescenceThicknessRange: [100, 400], 

            clearcoat: 1.0, 
            clearcoatRoughness: 0.05,

            transparent: true, 
            opacity: isGhost ? 0.3 : 1.0,
            
            side: THREE.DoubleSide, 
            depthWrite: true,
        });
        
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.scale.set(size, size, size);
        core.userData.node = node;
        core.rotation.y = Math.random() * Math.PI * 2; 
        group.add(core);
        group.userData.core = core; 

        // 内部光源
        const innerLight = new THREE.PointLight(threeColor, isGhost ? 0.8 : 2.5, size * 20);
        innerLight.position.set(0, 0, 0); 
        group.add(innerLight);
        group.userData.innerLight = innerLight;

        // 後光（Glow）
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = 128; glowCanvas.height = 128;
        const ctx = glowCanvas.getContext('2d');
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255,255,255,1.0)'); 
        grad.addColorStop(0.2, `rgba(${threeColor.r*255}, ${threeColor.g*255}, ${threeColor.b*255}, 0.8)`); 
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.fillRect(0,0,128,128);
        
        const glowTex = new THREE.CanvasTexture(glowCanvas);
        const glowMat = new THREE.SpriteMaterial({ 
            map: glowTex, 
            color: threeColor, 
            transparent: true, 
            blending: THREE.AdditiveBlending, 
            opacity: isGhost ? 0.1 : 0.5,
            depthWrite: false
        });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(size * 8, size * 8, 1);
        group.add(glow);
        group.userData.glow = glow; 

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
            this.draggedLight = this.draggedGroup.userData.innerLight; 
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
            let nodeColor = node.color || '#00f2f2'; 
            const isGhost = !!node.isGhost;
            const size = (node.size || 20) * 0.9;

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
                // UIの色変更同期（エッジの同期は削除済み）
                data.group.userData.core.scale.set(size, size, size);
                data.group.userData.glow.scale.set(size * 8, size * 8, 1); 
                
                data.group.userData.core.material.emissive.copy(threeColor);
                data.group.userData.glow.material.color.copy(threeColor); 
                
                if (data.group.userData.innerLight) {
                    data.group.userData.innerLight.color.copy(threeColor);
                    data.group.userData.innerLight.intensity = isGhost ? 0.5 : 2.5;
                }

                data.group.userData.core.material.opacity = isGhost ? 0.3 : 1.0;
                data.group.userData.glow.material.opacity = isGhost ? 0.1 : 0.5;
            }

            if (this.draggedNode !== node && this.app.grabbedNode !== node) {
                const targetX = node.x || 0;
                const targetY = -(node.y || 0); 
                const targetZ = node.z || 0;
                data.group.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.08); 
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
            
            let nextX = 0, nextY = 0;
            if (this.currentUniverse.nodes.length > 0) {
                this.app.currentUniverse.nodes.forEach(n => { nextX += (n.x || 0); nextY += -(n.y || 0); });
                nextX /= this.app.currentUniverse.nodes.length;
                nextY /= this.app.currentUniverse.nodes.length;
            } else {
                nextX = -this.app.camera.x; nextY = this.app.camera.y;
            }
            this.camera.position.set(nextX, nextY, 500); 
            this.controls.target.set(nextX, nextY, 0); 
        }

        this.syncNodes();

        this.nodeDataMap.forEach((data) => {
            if (data.group.userData.core) {
                // 自転
                data.group.userData.core.rotation.y += 0.003;
                data.group.userData.core.rotation.z += 0.001;
                
                // 浮遊
                const bpm = 153;
                const msPerBeat = 60000 / (bpm / 2);
                const beatPhase = (Date.now() % msPerBeat) / msPerBeat;
                const pulse = Math.pow(Math.sin(beatPhase * Math.PI), 2);
                
                const baseZ = data.group.userData.node.z || 0;
                data.group.position.z = baseZ + (Math.sin(Date.now() * 0.001 + data.group.position.x) * 5); 
                
                if (data.group.userData.innerLight) {
                    const baseIntensity = data.group.userData.node.isGhost ? 0.8 : 2.5;
                    data.group.userData.innerLight.intensity = baseIntensity + (pulse * baseIntensity * 0.15);
                }

                if (data.group.userData.glow) {
                    const baseScale = (data.group.userData.node.size || 20) * 0.9 * 8;
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
        
        if(this.scene.background && this.scene.background.isTexture) {
            this.scene.background.dispose();
        }
        
        this.renderer.dispose();
        this.canvas.remove();
    }
}