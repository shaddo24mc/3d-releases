// 1. Scene & Renderer Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150);
scene.fog = new THREE.Fog(0x87ceeb, 20, 128);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87ceeb);
renderer.setPixelRatio(1);
document.body.appendChild(renderer.domElement);
let stonehardness = 7500
let loghardness = 3000
let dirthardness = 750
let leafhardness = 300
const stats = new Stats();
stats.showPanel(0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(stats.dom);

// 2. Textures
const loader = new THREE.TextureLoader();
const loadTex = (url) => {
    const t = loader.load(url);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    return t;
};

const grassTop = loadTex('./textures/grass_block_top.png');
const grassSide = loadTex('./textures/grass_block_side.png');
const grassSideOverlay = loadTex('./textures/grass_block_side_overlay.png');
const dirt = loadTex('./textures/dirt.png');
const stone = loadTex('./textures/stone.png');
const logSide = loadTex('./textures/oak_log.png');
const logTop = loadTex('./textures/oak_log_top.png');
const leaves = loadTex('./textures/oak_leaves.png');
// Add to the end of Section 2
const destroyTextures = [];
// Make sure these match your actual file names!
for (let i = 0; i < 10; i++) {
    destroyTextures.push(loadTex(`./textures/destroy_stage_${i}.png`)); 
};
// 3. Materials
const grass_color = 0x8db753;

const grass_mat = [
    new THREE.MeshStandardMaterial({ map: grassSide }),
    new THREE.MeshStandardMaterial({ map: grassSide }),
    new THREE.MeshStandardMaterial({ map: grassTop, color: grass_color }),
    new THREE.MeshStandardMaterial({ map: dirt }),
    new THREE.MeshStandardMaterial({ map: grassSide }),
    new THREE.MeshStandardMaterial({ map: grassSide })
];

const invisibleMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const fringeMat = new THREE.MeshStandardMaterial({ 
    map: grassSideOverlay, 
    color: grass_color,
    transparent: true, 
    alphaTest: 0.5 
});

const side_overlay_mat = [fringeMat, fringeMat, invisibleMat, invisibleMat, fringeMat, fringeMat];

const log_mat = [
    new THREE.MeshStandardMaterial({ map: logSide }),
    new THREE.MeshStandardMaterial({ map: logSide }),
    new THREE.MeshStandardMaterial({ map: logTop }),
    new THREE.MeshStandardMaterial({ map: logTop }),
    new THREE.MeshStandardMaterial({ map: logSide }),
    new THREE.MeshStandardMaterial({ map: logSide })
];

const dirt_mat = new THREE.MeshStandardMaterial({ map: dirt });
const stone_mat = new THREE.MeshStandardMaterial({ map: stone });
const leaf_mat = new THREE.MeshStandardMaterial({ map: leaves, transparent: true, color: 0x7eb04d, alphaTest: 0.5 });
const destroyGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
const destroyMat = new THREE.MeshBasicMaterial({ 
    map: destroyTextures[0], // Start with phase 0
    transparent: true, 
    depthWrite: false, 
    color: 0x000000,
    opacity: 0.8
});
const destroyMesh = new THREE.Mesh(destroyGeo, destroyMat);
destroyMesh.visible = false; 
scene.add(destroyMesh);
// 4. World Variables, Master Seed & Memory System
const chunkSize = 16;
const renderDistance = 4;
const worldDepth = -64;
const heightScale = 12;
const geometry = new THREE.BoxGeometry(1, 1, 1);

// MASTER SEED: Generates a completely new, random world every time you refresh!
const worldSeed = Math.random(); 
noise.seed(worldSeed);

const activeChunks = {};
const interactableMeshes = [];
const brokenBlocks = new Set(); // The Memory Bank

// NEW: String-Based Avalanche Hash. 100% immune to JS 32-bit integer limits!
function getDeterministicRandom(x, y, z) {
    let str = `${x},${y},${z},${worldSeed}`;
    let h = 2166136261; 
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619); 
    }
    h ^= h >>> 13;
    h = Math.imul(h, 2246822507);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
}

// 5. Tree Logic (With Master Seed & Persistence)
function spawnTree(x, y, z, chunkMeshes, indices) {
    const trunkH = 4 + Math.floor(getDeterministicRandom(x, y, z) * 2);
    const treeMatrix = new THREE.Matrix4();
    
    for (let i = 0; i < trunkH; i++) {
        if (brokenBlocks.has(`${x},${y + i},${z}`)) continue;
        
        treeMatrix.setPosition(x, y + i, z);
        chunkMeshes.log.setMatrixAt(indices.l++, treeMatrix);
    }
    for (let ly = trunkH - 2; ly <= trunkH + 1; ly++) {
        let radius = (ly > trunkH - 1) ? 1 : 2; 
        for (let lx = -radius; lx <= radius; lx++) {
            for (let lz = -radius; lz <= radius; lz++) {
                const isCorner = Math.abs(lx) === radius && Math.abs(lz) === radius;
                if (isCorner) {
                    let trimChance = (ly === trunkH + 1) ? 1.0 : (ly === trunkH) ? 0.75 : (ly === trunkH - 1) ? 0.4 : 0.1;
                    if (getDeterministicRandom(x + lx, y + ly, z + lz) < trimChance) continue;
                }
                if (lx === 0 && lz === 0 && ly < trunkH) continue;
                
                const blockX = x + lx;
                const blockY = y + ly;
                const blockZ = z + lz;
                if (brokenBlocks.has(`${blockX},${blockY},${blockZ}`)) continue;

                treeMatrix.setPosition(blockX, blockY, blockZ);
                chunkMeshes.leaf.setMatrixAt(indices.lf++, treeMatrix);
            }
        }
    }
}

// 6. Chunk Generator
// 6. Chunk Generator
function generateChunk(chunkX, chunkZ) {
    const chunkId = `${chunkX},${chunkZ}`;
    if (activeChunks[chunkId]) return;

    const maxSurfaceBlocks = chunkSize * chunkSize;
    const maxDeepBlocks = chunkSize * chunkSize * 40; 
    
    const meshes = {
        grass: new THREE.InstancedMesh(geometry, grass_mat, maxSurfaceBlocks),
        overlay: new THREE.InstancedMesh(geometry, side_overlay_mat, maxSurfaceBlocks),
        dirt: new THREE.InstancedMesh(geometry, dirt_mat, maxDeepBlocks),
        stone: new THREE.InstancedMesh(geometry, stone_mat, maxDeepBlocks),
        log: new THREE.InstancedMesh(geometry, log_mat, 500),
        leaf: new THREE.InstancedMesh(geometry, leaf_mat, 2000)
    };

    for (const [key, mesh] of Object.entries(meshes)) {
        mesh.name = key;
        mesh.chunkId = chunkId;
        mesh.frustumCulled = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    }

    const indices = { g: 0, d: 0, s: 0, l: 0, lf: 0 };
    const matrix = new THREE.Matrix4();
    
    const startX = chunkX * chunkSize;
    const startZ = chunkZ * chunkSize;

    const terrain = [];
    for (let x = -1; x <= chunkSize; x++) {
        terrain[x + 1] = [];
        for (let z = -1; z <= chunkSize; z++) {
            let n = noise.perlin2((startX + x) / 25, (startZ + z) / 25);
            terrain[x + 1][z + 1] = Math.floor(((n + 1) / 2) * heightScale) + 10;
        }
    }

    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            let globalX = startX + x;
            let globalZ = startZ + z;
            let h = terrain[x + 1][z + 1];
            
            for (let y = worldDepth; y <= h; y++) {
                let isHidden = (
                    terrain[x + 2][z + 1] >= y && terrain[x][z + 1] >= y &&
                    terrain[x + 1][z + 2] >= y && terrain[x + 1][z] >= y && y < h
                );
                
                // Smart Culling: Check the Memory Bank to reveal hidden blocks!
                if (isHidden) {
                    if (brokenBlocks.has(`${globalX},${y + 1},${globalZ}`) || 
                        brokenBlocks.has(`${globalX},${y - 1},${globalZ}`) || 
                        brokenBlocks.has(`${globalX + 1},${y},${globalZ}`) || 
                        brokenBlocks.has(`${globalX - 1},${y},${globalZ}`) || 
                        brokenBlocks.has(`${globalX},${y},${globalZ + 1}`) || 
                        brokenBlocks.has(`${globalX},${y},${globalZ - 1}`))   
                    {
                        isHidden = false;
                    }
                }

                if (!isHidden) {
                    // 1. ✅ INDEPENDENT TREE LOGIC
                    // Check if a tree belongs here BEFORE we check if the dirt is broken
                    if (y === h) {
                        if (getDeterministicRandom(globalX, 0, globalZ) < 0.0002) {
                            spawnTree(globalX, y + 1, globalZ, meshes, indices);
                        }
                    }

                    // 2. ✅ GROUND BLOCK LOGIC
                    // Now, if this specific ground block is broken, skip drawing it
                    if (brokenBlocks.has(`${globalX},${y},${globalZ}`)) continue; 

                    matrix.setPosition(globalX, y, globalZ);
                    
                    if (y === h) {
                        meshes.grass.setMatrixAt(indices.g, matrix);
                        const overlayMat = new THREE.Matrix4().makeScale(1.002, 1.002, 1.002).setPosition(globalX, y, globalZ);
                        meshes.overlay.setMatrixAt(indices.g, overlayMat);
                        indices.g++;
                    } else if (y > h - 3) {
                        meshes.dirt.setMatrixAt(indices.d++, matrix);
                    } else {
                        meshes.stone.setMatrixAt(indices.s++, matrix);
                    }
                }
            }
        }
    }

    meshes.grass.count = meshes.overlay.count = indices.g;
    meshes.dirt.count = indices.d;
    meshes.stone.count = indices.s;
    meshes.log.count = indices.l;
    meshes.leaf.count = indices.lf;

    for (const mesh of Object.values(meshes)) {
        mesh.instanceMatrix.needsUpdate = true;
        scene.add(mesh);
        interactableMeshes.push(mesh);
    }
    activeChunks[chunkId] = meshes;
}

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
scene.add(hemiLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(50, 100, 20); // Angled in the sky
sunLight.castShadow = true;

sunLight.shadow.mapSize.width = 2000;
sunLight.shadow.mapSize.height = 2000;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 150;
sunLight.shadow.bias = -0.0005;
sunLight.shadow.normalBias = 0.05;


const d = 50; 
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;

scene.add(sunLight);
let lastPlayerChunkX = -999;
let lastPlayerChunkZ = -999;

function updateChunks() {
    const playerChunkX = Math.floor(camera.position.x / chunkSize);
    const playerChunkZ = Math.floor(camera.position.z / chunkSize);

    if (playerChunkX === lastPlayerChunkX && playerChunkZ === lastPlayerChunkZ) return;
    lastPlayerChunkX = playerChunkX;
    lastPlayerChunkZ = playerChunkZ;

    const chunksToKeep = new Set();

    for (let x = playerChunkX - renderDistance; x <= playerChunkX + renderDistance; x++) {
        for (let z = playerChunkZ - renderDistance; z <= playerChunkZ + renderDistance; z++) {
            generateChunk(x, z);
            chunksToKeep.add(`${x},${z}`);
        }
    }

    for (const chunkId in activeChunks) {
        if (!chunksToKeep.has(chunkId)) {
            const meshes = activeChunks[chunkId];
            for (const mesh of Object.values(meshes)) {
                scene.remove(mesh);
                const index = interactableMeshes.indexOf(mesh);
                if (index > -1) interactableMeshes.splice(index, 1);
                mesh.dispose();
            }
            delete activeChunks[chunkId];
        }
    }
}

// 8. Controls & Memory Mining
camera.position.set(0, 25, 0);
let yaw = 0, pitch = 0, keys = {};
const raycaster = new THREE.Raycaster();
raycaster.far = 6;

let mining = { active: false, startTime: 0, targetMesh: null, targetId: null, requiredTime: 500 };

function getTarget() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hit = raycaster.intersectObjects(interactableMeshes);
    return hit.length > 0 ? hit[0] : null;
}

function startMining(hit) {
    mining = {
        active: true, startTime: Date.now(), targetMesh: hit.object, targetId: hit.instanceId,
        requiredTime: (hit.object.name === 'stone') ? stonehardness : (hit.object.name === 'log') ? loghardness : (hit.object.name === 'dirt' || hit.object.name === 'grass' || hit.object.name === 'overlay') ? dirthardness : (hit.object.name === 'leaf') ? leafhardness : 1
    };

    // Reset to phase 0 when we start hitting a new block
    destroyMat.map = destroyTextures[0];
    destroyMat.needsUpdate = true;

    const blockMatrix = new THREE.Matrix4();
    hit.object.getMatrixAt(hit.instanceId, blockMatrix);
    const pos = new THREE.Vector3().setFromMatrixPosition(blockMatrix);
    
    destroyMesh.position.copy(pos);
    destroyMesh.visible = true; 
}

function updateMining() {
    if (!mining.active) {
        destroyMesh.visible = false;
        return;
    }
    
    const hit = getTarget();
    if (!hit || hit.object !== mining.targetMesh || hit.instanceId !== mining.targetId) {
        mining.active = false;
        destroyMesh.visible = false;
        if (hit) startMining(hit); 
        return;
    }

    // --- NEW: Calculate Mining Progress & Update Texture Phase ---
    const elapsed = Date.now() - mining.startTime;
    const progress = Math.min(elapsed / mining.requiredTime, 1.0); // 0.0 to 1.0
    
    // Multiply progress by 9.99 to get a number from 0 to 9, then floor it to get the index.
    const phaseIndex = Math.floor(progress * 9.99); 

    // Only update the material if the phase has actually changed to save performance
    if (destroyMat.map !== destroyTextures[phaseIndex]) {
        destroyMat.map = destroyTextures[phaseIndex];
        destroyMat.needsUpdate = true; // Tell Three.js the texture changed
    }
    // -------------------------------------------------------------

    if (elapsed >= mining.requiredTime) {
        // Block is broken!
        const mesh = mining.targetMesh;
        const targetIdx = mining.targetId;

        destroyMesh.visible = false; 

        // [Keep the rest of your exact chunk regeneration/memory code here...]
        const blockMatrix = new THREE.Matrix4();
        mesh.getMatrixAt(targetIdx, blockMatrix);
        const pos = new THREE.Vector3().setFromMatrixPosition(blockMatrix);
        
        brokenBlocks.add(`${Math.round(pos.x)},${Math.round(pos.y)},${Math.round(pos.z)}`);
        
        const chunkId = mesh.chunkId;
        const meshes = activeChunks[chunkId];
        
        for (const m of Object.values(meshes)) {
            scene.remove(m);
            const index = interactableMeshes.indexOf(m);
            if (index > -1) interactableMeshes.splice(index, 1);
            m.dispose();
        }
        delete activeChunks[chunkId];
        
        const [cX, cZ] = chunkId.split(',').map(Number);
        generateChunk(cX, cZ);

        const next = getTarget();
        if (next) startMining(next); else mining.active = false;
    }
}
// 9. Listeners & Loop
document.addEventListener('mousedown', (e) => {
    if (!document.pointerLockElement) renderer.domElement.requestPointerLock();
    else if (e.button === 0) { const hit = getTarget(); if (hit) startMining(hit); }
});
document.addEventListener('mouseup', () => mining.active = false);
document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement) {
        yaw -= e.movementX * 0.002;
        pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch - e.movementY * 0.002));
    }
});
window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    updateChunks();
    updateMining();
    
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    const rgt = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    if (keys.w) camera.position.addScaledVector(fwd, -0.15);
    if (keys.s) camera.position.addScaledVector(fwd, 0.15);
    if (keys.a) camera.position.addScaledVector(rgt, 0.15);
    if (keys.d) camera.position.addScaledVector(rgt, -0.15);
    if (keys[' ']) camera.position.y += 0.15;
    if (keys.shift) camera.position.y -= 0.15;
    
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    renderer.render(scene, camera);
    stats.update();
}
animate();
