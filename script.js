const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 75);
scene.fog = new THREE.Fog(0x87ceeb, 50, 150);

// Performance: Limit pixel ratio to 1 (prevents massive slowdowns on Retina/mobile screens)
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87ceeb);
renderer.setPixelRatio(1); 
document.body.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const moveSpeed = 10;
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

// Shadows completely disabled. They are too heavy for InstancedMesh terrain.
renderer.shadowMap.enabled = false; 

// ----------------------------------------------------
// UI: Crosshair, Hotbar, & Full Inventory
// ----------------------------------------------------
// Crosshair
const crosshair = document.createElement('div');
crosshair.style.position = 'absolute';
crosshair.style.top = '50%';
crosshair.style.left = '50%';
crosshair.style.width = '20px';
crosshair.style.height = '20px';
crosshair.style.transform = 'translate(-50%, -50%)';
crosshair.style.pointerEvents = 'none'; // So clicks pass through to the game
crosshair.style.zIndex = '100';
crosshair.innerHTML = '<div style="position:absolute;top:9px;left:0;width:20px;height:2px;background:rgba(255,255,255,0.8);"></div><div style="position:absolute;top:0;left:9px;width:2px;height:20px;background:rgba(255,255,255,0.8);"></div>';
document.body.appendChild(crosshair);

// --- Inventory State ---
const INVENTORY_SIZE = 36; // 0-8 is Hotbar, 9-35 is Main Inventory
const inventory = Array(INVENTORY_SIZE).fill(null).map(() => ({ type: null, count: 0 }));

// Starting items for testing!
inventory[0] = { type: 'stone', count: 64 };
inventory[1] = { type: 'dirt', count: 64 };
inventory[2] = { type: 'grass_block', count: 64 };
inventory[3] = { type: 'oak_log', count: 64 };
inventory[4] = { type: 'spruce_log', count: 64 };
inventory[5] = { type: 'sand', count: 64 };
inventory[8] = { type: 'diamond_pickaxe', count: 1 };

let selectedSlot = 0;
let heldItem = { type: null, count: 0 }; // For moving items around the inventory

// Helper to get image paths (You can add more here as you gather pictures!)
function getItemImage(type) {
    if (!type) return 'none';
    const customTextures = {
        grass_block: './textures/grass_block_side.png',
        oak_log: './textures/oak_log.png',
        spruce_log: './textures/spruce_log.png',
        snowy_grass_block: './textures/grass_block_snow.png',
        raw_iron: './items/raw_iron.png',
        raw_gold: './items/raw_gold.png',
        raw_copper: './items/raw_copper.png', // Fixed typo here
        redstone: './items/redstone_dust.png', // Fixed typo here
        diamond_pickaxe: './items/diamond_pickaxe.png',
        
        // --- NEW ITEMS ADDED TO DROPS ---
        coal: './items/coal.png',
        diamond: './items/diamond.png',
        emerald: './items/emerald.png',
        lapis_lazuli: './items/lapis_lazuli.png',
        snowball: './items/snowball.png',
        oak_sapling: './textures/oak_sapling.png',
        spruce_sapling: './textures/spruce_sapling.png',
        cobblestone: './textures/cobblestone.png',
        cobbled_deepslate: './textures/cobbled_deepslate.png'
    };
    return `url(${customTextures[type] || `./textures/${type}.png`})`;
}

// --- Hotbar UI (Bottom of screen) ---
const hotbarContainer = document.createElement('div');
hotbarContainer.id = 'hotbar';
hotbarContainer.style.position = 'absolute';
hotbarContainer.style.bottom = '20px';
hotbarContainer.style.left = '50%';
hotbarContainer.style.transform = 'translateX(-50%)';
hotbarContainer.style.display = 'flex';
hotbarContainer.style.gap = '4px';
hotbarContainer.style.padding = '6px';
hotbarContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
hotbarContainer.style.border = '3px solid #444';
hotbarContainer.style.borderRadius = '4px';
document.body.appendChild(hotbarContainer);

const hotbarSlotsUI = [];
for (let i = 0; i < 9; i++) {
    const slot = document.createElement('div');
    slot.style.width = '44px';
    slot.style.height = '44px';
    slot.style.border = '3px solid #888';
    slot.style.backgroundColor = 'rgba(200, 200, 200, 0.3)';
    slot.style.boxSizing = 'border-box';
    slot.style.position = 'relative';
    slot.style.cursor = 'pointer';
    
    const countLabel = document.createElement('span');
    countLabel.style.position = 'absolute';
    countLabel.style.bottom = '2px';
    countLabel.style.right = '4px';
    countLabel.style.color = 'white';
    countLabel.style.fontWeight = 'bold';
    countLabel.style.fontFamily = 'monospace';
    countLabel.style.fontSize = '14px';
    countLabel.style.textShadow = '1px 1px 0 #000';
    slot.appendChild(countLabel);
    
    // Allow clicking the HUD hotbar to select items
    slot.addEventListener('mousedown', () => {
        if (inventoryScreen.style.display === 'none') {
            selectedSlot = i;
            updateInventoryUI();
        }
    });

    hotbarContainer.appendChild(slot);
    hotbarSlotsUI.push({ div: slot, label: countLabel });
}

// --- Full Inventory UI (Press 'E') ---
const inventoryScreen = document.createElement('div');
inventoryScreen.id = 'inventory-screen';
inventoryScreen.style.position = 'absolute';
inventoryScreen.style.top = '50%';
inventoryScreen.style.left = '50%';
inventoryScreen.style.transform = 'translate(-50%, -50%)';
inventoryScreen.style.backgroundColor = '#c6c6c6'; // Classic MC gray
inventoryScreen.style.border = '4px solid #555';
inventoryScreen.style.padding = '20px';
inventoryScreen.style.display = 'none'; // Hidden by default
inventoryScreen.style.flexDirection = 'column';
inventoryScreen.style.gap = '20px';
inventoryScreen.style.boxShadow = 'inset -4px -4px 0 rgba(0,0,0,0.2), inset 4px 4px 0 rgba(255,255,255,0.5)';
inventoryScreen.style.zIndex = '200';
document.body.appendChild(inventoryScreen);

// Title
const invTitle = document.createElement('div');
invTitle.innerText = "Inventory";
invTitle.style.fontFamily = "monospace";
invTitle.style.fontWeight = "bold";
invTitle.style.color = "#333";
inventoryScreen.appendChild(invTitle);

// Main Inventory Grid
const mainGrid = document.createElement('div');
mainGrid.style.display = 'grid';
mainGrid.style.gridTemplateColumns = 'repeat(9, 44px)';
mainGrid.style.gap = '4px';
inventoryScreen.appendChild(mainGrid);

// Spacer
const spacer = document.createElement('div');
spacer.style.height = '10px';
inventoryScreen.appendChild(spacer);

// Hotbar Grid (Inside Inventory Menu)
const invHotbarGrid = document.createElement('div');
invHotbarGrid.style.display = 'grid';
invHotbarGrid.style.gridTemplateColumns = 'repeat(9, 44px)';
invHotbarGrid.style.gap = '4px';
inventoryScreen.appendChild(invHotbarGrid);

// Create all 36 interactive slots
const allSlotsUI = [];

// Custom cursor attached to mouse for dragging items
const heldItemUI = document.createElement('div');
heldItemUI.style.position = 'absolute';
heldItemUI.style.width = '44px';
heldItemUI.style.height = '44px';
heldItemUI.style.pointerEvents = 'none';
heldItemUI.style.zIndex = '300';
heldItemUI.style.display = 'none';
const heldLabel = document.createElement('span');
heldLabel.style.position = 'absolute';
heldLabel.style.bottom = '2px';
heldLabel.style.right = '4px';
heldLabel.style.color = 'white';
heldLabel.style.fontWeight = 'bold';
heldLabel.style.fontFamily = 'monospace';
heldLabel.style.textShadow = '1px 1px 0 #000';
heldItemUI.appendChild(heldLabel);
document.body.appendChild(heldItemUI);

document.addEventListener('mousemove', (e) => {
    if (inventoryScreen.style.display === 'flex') {
        heldItemUI.style.left = e.clientX - 22 + 'px';
        heldItemUI.style.top = e.clientY - 22 + 'px';
    }
});

for (let i = 0; i < INVENTORY_SIZE; i++) {
    const slot = document.createElement('div');
    slot.style.width = '44px';
    slot.style.height = '44px';
    slot.style.backgroundColor = '#8b8b8b';
    slot.style.boxShadow = 'inset -2px -2px 0 #fff, inset 2px 2px 0 #373737';
    slot.style.position = 'relative';
    slot.style.cursor = 'pointer';
    
    const countLabel = document.createElement('span');
    countLabel.style.position = 'absolute';
    countLabel.style.bottom = '2px';
    countLabel.style.right = '4px';
    countLabel.style.color = 'white';
    countLabel.style.fontWeight = 'bold';
    countLabel.style.fontFamily = 'monospace';
    countLabel.style.fontSize = '14px';
    countLabel.style.textShadow = '1px 1px 0 #000';
    slot.appendChild(countLabel);
    
    // Click to swap/move items!
    slot.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if (e.button === 0) { // Left click
            let tempType = inventory[i].type;
            let tempCount = inventory[i].count;
            
            // If they are the same type, stack them!
            if (heldItem.type === inventory[i].type && heldItem.type !== null) {
                let space = 64 - inventory[i].count;
                let toMove = Math.min(space, heldItem.count);
                inventory[i].count += toMove;
                heldItem.count -= toMove;
                if (heldItem.count <= 0) heldItem.type = null;
            } else {
                // Otherwise, swap them
                inventory[i].type = heldItem.type;
                inventory[i].count = heldItem.count;
                heldItem.type = tempType;
                heldItem.count = tempCount;
            }
            updateInventoryUI();
        }
    });

    if (i < 9) {
        invHotbarGrid.appendChild(slot); // Slots 0-8 are Hotbar
    } else {
        mainGrid.appendChild(slot); // Slots 9-35 are Main Inventory
    }
    allSlotsUI.push({ div: slot, label: countLabel });
}

function updateInventoryUI() {
    // Update Main HUD Hotbar
    for (let i = 0; i < 9; i++) {
        const item = inventory[i];
        const ui = hotbarSlotsUI[i];
        ui.div.style.backgroundImage = getItemImage(item.type);
        ui.div.style.backgroundSize = 'cover';
        ui.div.style.imageRendering = 'pixelated';
        ui.label.innerText = (item.count > 1) ? item.count : '';
        
        if (i === selectedSlot) {
            ui.div.style.border = '3px solid #fff';
            ui.div.style.transform = 'scale(1.15)';
            ui.div.style.zIndex = '10';
        } else {
            ui.div.style.border = '3px solid #888';
            ui.div.style.transform = 'scale(1)';
            ui.div.style.zIndex = '1';
        }
    }
    
    // Update Full E-Menu Grid
    for (let i = 0; i < INVENTORY_SIZE; i++) {
        const item = inventory[i];
        const ui = allSlotsUI[i];
        ui.div.style.backgroundImage = getItemImage(item.type);
        ui.div.style.backgroundSize = 'cover';
        ui.div.style.imageRendering = 'pixelated';
        ui.label.innerText = (item.count > 1) ? item.count : '';
    }
    
    // Update Mouse Cursor (Dragging item)
    if (heldItem.type) {
        heldItemUI.style.display = 'block';
        heldItemUI.style.backgroundImage = getItemImage(heldItem.type);
        heldItemUI.style.backgroundSize = 'cover';
        heldItemUI.style.imageRendering = 'pixelated';
        heldLabel.innerText = (heldItem.count > 1) ? heldItem.count : '';
    } else {
        heldItemUI.style.display = 'none';
    }
}

function addItemToInventory(type, amount) {
    // 1. Try to add to an existing stack
    for (let i = 0; i < INVENTORY_SIZE; i++) {
        if (inventory[i].type === type && inventory[i].count < 64) {
            let space = 64 - inventory[i].count;
            let toAdd = Math.min(space, amount);
            inventory[i].count += toAdd;
            amount -= toAdd;
            if (amount <= 0) break;
        }
    }
    // 2. If we still have some left, find an empty slot
    if (amount > 0) {
        for (let i = 0; i < INVENTORY_SIZE; i++) {
            if (inventory[i].type === null) {
                inventory[i].type = type;
                inventory[i].count = amount;
                amount = 0;
                break;
            }
        }
    }
    updateInventoryUI();
}

updateInventoryUI(); // Initial draw

// ----------------------------------------------------
// 1. Centralized Block & Material System
// ----------------------------------------------------
const BLOCK_HARDNESS = {
    stone: 7500, coal_ore: 15000, iron_ore: 15000, copper_ore: 10000, gold_ore: 15000, emerald_ore: 15000, redstone_ore: 15000, lapis_ore: 15000, diamond_ore: 15000, cobblestone: 7500, cobbled_deepslate: 20000,
    oak_log: 3000, oak_leaves: 300, spruce_log: 3000, spruce_leaves: 300, dirt: 750, grass_block: 750, grass_block_overlay: 750, 
    snowy_grass_block: 750, sand: 600, snow_block: 500, sandstone: 4000,
    deepslate: 20000, 
    deepslate_coal_ore: 22500, deepslate_iron_ore: 22500, deepslate_copper_ore: 15000, 
    deepslate_gold_ore: 22500, deepslate_emerald_ore: 22500, deepslate_redstone_ore: 22500, 
    deepslate_lapis_ore: 22500, deepslate_diamond_ore: 22500,
    oak_sapling: 0, spruce_sapling: 0,
    bedrock: 999999999
};

const BLOCK_DROPS = {
    // Surface Blocks
    grass_block: { item: 'dirt', count: 1 },
    snowy_grass_block: { item: 'dirt', count: 1 },
    dirt: { item: 'dirt', count: 1 },
    sand: { item: 'sand', count: 1 },
    sandstone: { item: 'sandstone', count: 1 },
    snow_block: { item: 'snowball', count: 4 },
    oak_sapling: { item: 'oak_sapling', count: 1 },
    spruce_sapling: { item: 'spruce_sapling', count: 1 },

    // Stones
    stone: { item: 'cobblestone', count: 1 },
    deepslate: { item: 'cobbled_deepslate', count: 1 },
    cobblestone: { item: 'cobblestone', count: 1 },
    cobbled_deepslate: { item: 'cobbled_deepslate', count: 1 },

    // Normal Ores
    coal_ore: { item: 'coal', count: 1 },
    iron_ore: { item: 'raw_iron', count: 1 },
    copper_ore: { item: 'raw_copper', count: () => 2 + Math.floor(Math.random() * 4) }, // Drops 2-5
    gold_ore: { item: 'raw_gold', count: 1 },
    diamond_ore: { item: 'diamond', count: 1 },
    lapis_ore: { item: 'lapis_lazuli', count: () => 4 + Math.floor(Math.random() * 6) }, // Drops 4-9
    redstone_ore: { item: 'redstone', count: () => 4 + Math.floor(Math.random() * 2) }, // Drops 4-5
    emerald_ore: { item: 'emerald', count: 1 },

    // Deepslate Ores
    deepslate_coal_ore: { item: 'coal', count: 1 },
    deepslate_iron_ore: { item: 'raw_iron', count: 1 },
    deepslate_copper_ore: { item: 'raw_copper', count: () => 2 + Math.floor(Math.random() * 4) },
    deepslate_gold_ore: { item: 'raw_gold', count: 1 },
    deepslate_diamond_ore: { item: 'diamond', count: 1 },
    deepslate_lapis_ore: { item: 'lapis_lazuli', count: () => 4 + Math.floor(Math.random() * 6) },
    deepslate_redstone_ore: { item: 'redstone', count: () => 4 + Math.floor(Math.random() * 2) },
    deepslate_emerald_ore: { item: 'emerald', count: 1 },

    // Trees
    oak_log: { item: 'oak_log', count: 1 },
    spruce_log: { item: 'spruce_log', count: 1 },
    // 5% chance to drop a sapling when breaking leaves, otherwise drops 0
    oak_leaves: { item: 'oak_sapling', count: () => Math.random() < 0.05 ? 1 : 0 },
    spruce_leaves: { item: 'spruce_sapling', count: () => Math.random() < 0.05 ? 1 : 0 },

    // Unbreakable
    bedrock: null
};

const BLOCK_TOOL_REQUIREMENT = {
    stone: 'pickaxe', deepslate: 'pickaxe', sandstone: 'pickaxe',
    coal_ore: 'pickaxe', iron_ore: 'pickaxe', copper_ore: 'pickaxe', gold_ore: 'pickaxe', redstone_ore: 'pickaxe', emerald_ore: 'pickaxe', lapis_ore: 'pickaxe', diamond_ore: 'pickaxe',
    deepslate_coal_ore: 'pickaxe', deepslate_iron_ore: 'pickaxe', deepslate_copper_ore: 'pickaxe', deepslate_gold_ore: 'pickaxe', deepslate_redstone_ore: 'pickaxe', deepslate_emerald_ore: 'pickaxe', deepslate_lapis_ore: 'pickaxe', deepslate_diamond_ore: 'pickaxe'
};

// MINECRAFT 1.18+ ORE CONFIGURATION
const ORE_CONFIG = {
    emerald_ore: [{ min: -16, max: 320, peak: 232, threshold: 0.78 }],
    diamond_ore: [{ min: -64, max: 16,  peak: -64, threshold: 0.72 }],
    lapis_ore:   [
        { min: -64, max: 64,  peak: 0, threshold: 0.68 }, 
        { min: -32, max: 32,  threshold: 0.65 } 
    ],
    gold_ore:    [{ min: -64, max: 32,  peak: -16, threshold: 0.68 }],
    redstone_ore:[
        { min: -64, max: 15,  threshold: 0.65 },
        { min: -64, max: -32, peak: -64, threshold: 0.62 }
    ],
    copper_ore:  [{ min: -16, max: 112, peak: 48, threshold: 0.60 }],
    iron_ore:    [
        { min: -64, max: 72,  peak: 16, threshold: 0.55 },
        { min: 80,  max: 320, peak: 232, threshold: 0.55 },
        { min: -64, max: -32, threshold: 0.58 }
    ],
    coal_ore:    [
        { min: 0,   max: 192, peak: 96, threshold: 0.50 },
        { min: 136, max: 320, threshold: 0.55 }
    ],
};

const loader = new THREE.TextureLoader();
const loadTex = (url) => {
    const t = loader.load(url);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false; 
    return t;
};

// Textures
const grassTop = loadTex('./textures/grass_block_top.png');
const grassSide = loadTex('./textures/grass_block_side.png');
const grassSideOverlay = loadTex('./textures/grass_block_side_overlay.png');
const dirt = loadTex('./textures/dirt.png');
const stone = loadTex('./textures/stone.png');
const logSide = loadTex('./textures/oak_log.png');
const logTop = loadTex('./textures/oak_log_top.png');
const leaves = loadTex('./textures/oak_leaves.png');

const spruceLogSide = loadTex('./textures/spruce_log.png');
const spruceLogTop = loadTex('./textures/spruce_log_top.png');
const spruceLeaves = loadTex('./textures/spruce_leaves.png');

const coalore = loadTex('./textures/coal_ore.png');
const ironore = loadTex('./textures/iron_ore.png');
const copperore = loadTex('./textures/copper_ore.png');
const goldore = loadTex('./textures/gold_ore.png');
const redstoneore = loadTex('./textures/redstone_ore.png');
const emeraldore = loadTex('./textures/emerald_ore.png');
const lapisore = loadTex('./textures/lapis_ore.png');
const diamondore = loadTex('./textures/diamond_ore.png');
const deepslatetop = loadTex('./textures/deepslate_top.png');
const deepslate = loadTex('./textures/deepslate.png');
const deepslateironore = loadTex('./textures/deepslate_iron_ore.png');
const deepslatecoalore = loadTex('./textures/deepslate_coal_ore.png');
const deepslatecopperore = loadTex('./textures/deepslate_copper_ore.png');
const deepslategoldore = loadTex('./textures/deepslate_gold_ore.png');
const deepslateredstoneore = loadTex('./textures/deepslate_redstone_ore.png');
const deepslateemeraldore = loadTex('./textures/deepslate_emerald_ore.png');
const deepslatelapisore = loadTex('./textures/deepslate_lapis_ore.png');
const deepslatediamondore = loadTex('./textures/deepslate_diamond_ore.png');
const bedrock = loadTex('./textures/bedrock.png');

const sand = loadTex('./textures/sand.png'); 
const snow = loadTex('./textures/snow.png');
const snowyGrassSide = loadTex('./textures/grass_block_snow.png');
const sandstonetop = loadTex('./textures/sandstone_top.png');
const sandstoneside = loadTex('./textures/sandstone.png');
const sandstonebottom = loadTex('./textures/sandstone_bottom.png');

const oakSaplingTex = loadTex('./textures/oak_sapling.png');
const spruceSaplingTex = loadTex('./textures/spruce_sapling.png');

// --- NEW TEXTURES FOR DROPS ---
const cobblestoneTex = loadTex('./textures/cobblestone.png');
const cobbledDeepslateTex = loadTex('./textures/cobbled_deepslate.png');
const coalTex = loadTex('./items/coal.png');
const rawIronTex = loadTex('./items/raw_iron.png');
const rawCopperTex = loadTex('./items/raw_copper.png');
const rawGoldTex = loadTex('./items/raw_gold.png');
const diamondTex = loadTex('./items/diamond.png');
const emeraldTex = loadTex('./items/emerald.png');
const lapisTex = loadTex('./items/lapis_lazuli.png');
const redstoneTex = loadTex('./items/redstone_dust.png');
const snowballTex = loadTex('./items/snowball.png');

const destroyTextures = [];
for (let i = 0; i < 10; i++) {
    destroyTextures.push(loadTex(`./textures/destroy_stage_${i}.png`)); 
}

const grass_color = 0x8db753;
const invisibleMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const fringeMat = new THREE.MeshStandardMaterial({ 
    map: grassSideOverlay, color: grass_color, transparent: true, alphaTest: 0.5 
});

const materials = {
    grass_block: [
        new THREE.MeshStandardMaterial({ map: grassSide }),
        new THREE.MeshStandardMaterial({ map: grassSide }),
        new THREE.MeshStandardMaterial({ map: grassTop, color: grass_color }),
        new THREE.MeshStandardMaterial({ map: dirt }),
        new THREE.MeshStandardMaterial({ map: grassSide }),
        new THREE.MeshStandardMaterial({ map: grassSide })
    ],
    snowy_grass_block: [
        new THREE.MeshStandardMaterial({ map: snowyGrassSide }),
        new THREE.MeshStandardMaterial({ map: snowyGrassSide }),
        new THREE.MeshStandardMaterial({ map: snow }), 
        new THREE.MeshStandardMaterial({ map: dirt }),
        new THREE.MeshStandardMaterial({ map: snowyGrassSide }),
        new THREE.MeshStandardMaterial({ map: snowyGrassSide })
    ],
    grass_block_overlay: [fringeMat, fringeMat, invisibleMat, invisibleMat, fringeMat, fringeMat],
    dirt: new THREE.MeshStandardMaterial({ map: dirt }),
    stone: new THREE.MeshStandardMaterial({ map: stone }),
    sand: new THREE.MeshStandardMaterial({ map: sand }),
    sandstone: [
        new THREE.MeshStandardMaterial({ map: sandstoneside}),
        new THREE.MeshStandardMaterial({ map: sandstoneside}),
        new THREE.MeshStandardMaterial({ map: sandstonetop}),
        new THREE.MeshStandardMaterial({ map: sandstonebottom}),
        new THREE.MeshStandardMaterial({ map: sandstoneside}),
        new THREE.MeshStandardMaterial({ map: sandstoneside})
    ],
    snow_block: new THREE.MeshStandardMaterial({ map: snow}), 

    // --- MATERIALS FOR ITEMS & NEW BLOCKS ---
    cobblestone: new THREE.MeshStandardMaterial({ map: cobblestoneTex }),
    cobbled_deepslate: new THREE.MeshStandardMaterial({ map: cobbledDeepslateTex }),
    coal: new THREE.MeshStandardMaterial({ map: coalTex, transparent: true, alphaTest: 0.5 }),
    raw_iron: new THREE.MeshStandardMaterial({ map: rawIronTex, transparent: true, alphaTest: 0.5 }),
    raw_copper: new THREE.MeshStandardMaterial({ map: rawCopperTex, transparent: true, alphaTest: 0.5 }),
    raw_gold: new THREE.MeshStandardMaterial({ map: rawGoldTex, transparent: true, alphaTest: 0.5 }),
    diamond: new THREE.MeshStandardMaterial({ map: diamondTex, transparent: true, alphaTest: 0.5 }),
    emerald: new THREE.MeshStandardMaterial({ map: emeraldTex, transparent: true, alphaTest: 0.5 }),
    lapis_lazuli: new THREE.MeshStandardMaterial({ map: lapisTex, transparent: true, alphaTest: 0.5 }),
    redstone: new THREE.MeshStandardMaterial({ map: redstoneTex, transparent: true, alphaTest: 0.5 }),
    snowball: new THREE.MeshStandardMaterial({ map: snowballTex, transparent: true, alphaTest: 0.5 }),

    coal_ore: new THREE.MeshStandardMaterial({ map: coalore }),
    iron_ore: new THREE.MeshStandardMaterial({ map: ironore }),
    copper_ore: new THREE.MeshStandardMaterial({ map: copperore }),
    gold_ore: new THREE.MeshStandardMaterial({map: goldore}),
    redstone_ore: new THREE.MeshStandardMaterial({map: redstoneore}),
    emerald_ore: new THREE.MeshStandardMaterial({map: emeraldore}),
    lapis_ore: new THREE.MeshStandardMaterial({map: lapisore}),
    diamond_ore: new THREE.MeshStandardMaterial({map: diamondore}),
    deepslate: [
        new THREE.MeshStandardMaterial({ map: deepslate }),
        new THREE.MeshStandardMaterial({ map: deepslate }),
        new THREE.MeshStandardMaterial({ map: deepslatetop}),
        new THREE.MeshStandardMaterial({ map: deepslatetop}),
        new THREE.MeshStandardMaterial({ map: deepslate }),
        new THREE.MeshStandardMaterial({ map: deepslate })
    ],
    deepslate_coal_ore: new THREE.MeshStandardMaterial({ map: deepslatecoalore}),
    deepslate_copper_ore: new THREE.MeshStandardMaterial({ map: deepslatecopperore}),
    deepslate_iron_ore: new THREE.MeshStandardMaterial({ map: deepslateironore}),
    deepslate_gold_ore: new THREE.MeshStandardMaterial({ map: deepslategoldore}),
    deepslate_redstone_ore: new THREE.MeshStandardMaterial({ map: deepslateredstoneore}),
    deepslate_emerald_ore: new THREE.MeshStandardMaterial({ map: deepslateemeraldore}),
    deepslate_lapis_ore: new THREE.MeshStandardMaterial({ map: deepslatelapisore}),
    deepslate_diamond_ore: new THREE.MeshStandardMaterial({ map: deepslatediamondore}),
    bedrock: new THREE.MeshStandardMaterial({ map: bedrock}),
    oak_leaves: new THREE.MeshStandardMaterial({ map: leaves, transparent: true, color: 0x7eb04d, alphaTest: 0.5 }),
    oak_sapling: new THREE.MeshStandardMaterial({ map: oakSaplingTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
    oak_log: [
        new THREE.MeshStandardMaterial({ map: logSide }),
        new THREE.MeshStandardMaterial({ map: logSide }),
        new THREE.MeshStandardMaterial({ map: logTop }),
        new THREE.MeshStandardMaterial({ map: logTop }),
        new THREE.MeshStandardMaterial({ map: logSide }),
        new THREE.MeshStandardMaterial({ map: logSide })
    ],
    spruce_leaves: new THREE.MeshStandardMaterial({ map: spruceLeaves, transparent: true, color: 0x476a35, alphaTest: 0.5 }), 
    spruce_sapling: new THREE.MeshStandardMaterial({ map: spruceSaplingTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
    spruce_log: [
        new THREE.MeshStandardMaterial({ map: spruceLogSide }),
        new THREE.MeshStandardMaterial({ map: spruceLogSide }),
        new THREE.MeshStandardMaterial({ map: spruceLogTop }),
        new THREE.MeshStandardMaterial({ map: spruceLogTop }),
        new THREE.MeshStandardMaterial({ map: spruceLogSide }),
        new THREE.MeshStandardMaterial({ map: spruceLogSide })
    ]
};

const destroyGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
const destroyMat = new THREE.MeshBasicMaterial({ 
    map: destroyTextures[0], transparent: true, depthWrite: false, color: 0xA9A9A9, opacity: 0.8
});
const destroyMesh = new THREE.Mesh(destroyGeo, destroyMat);
destroyMesh.visible = false; 
scene.add(destroyMesh);

// ----------------------------------------------------
// 2. BIOME REGISTRY 
// ----------------------------------------------------
const BIOME_REGISTRY = [
    { name: "Forest", temp: 0.15, moist: 0.3, depth: 0.0, topBlock: 'grass_block', subBlock: 'dirt', deepSubBlock: 'stone', treeChance: 0.015, heightScale: 20, treeType: 'oak' },
    { name: "Plains", temp: 0.0, moist: -0.1, depth: 0.0, topBlock: 'grass_block', subBlock: 'dirt', deepSubBlock: 'stone', treeChance: 0.0001, heightScale: 8, treeType: 'oak' },
    { name: "Desert", temp: 0.35, moist: -0.35, depth: 0.0, topBlock: 'sand', subBlock: 'sand', deepSubBlock: 'sandstone', treeChance: 0.0, heightScale: 12, treeType: 'oak' },
    { name: "Snowy Tundra", temp: -0.35, moist: 0.1, depth: 0.0, topBlock: 'snowy_grass_block', subBlock: 'dirt', deepSubBlock: 'stone', treeChance: 0.002, heightScale: 15, treeType: 'spruce' },
    { name: "Mountains", temp: 0.3, moist: 0.3, depth: 0.0, topBlock: 'stone', subBlock: 'stone', deepSubBlock: 'stone', treeChance: 0.0, heightScale: 55, treeType: 'spruce' }
];

// ----------------------------------------------------
// 3. World Variables & Global Systems
// ----------------------------------------------------
const chunkSize = 16;
const renderDistance = 2; 
const worldHeight = 384;
const minworldY = -64;
const geometry = new THREE.BoxGeometry(1, 1, 1);

// --- Cross Geometry for Plants (X shape) ---
const crossGeo = new THREE.BufferGeometry();
const crossPositions = new Float32Array([
    // Plane 1 (/)
    -0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5,  0.5, -0.5,
     0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5, -0.5,
    // Plane 2 (\)
    -0.5, -0.5,  0.5,   0.5, -0.5, -0.5,  -0.5,  0.5,  0.5,
     0.5, -0.5, -0.5,   0.5,  0.5, -0.5,  -0.5,  0.5,  0.5
]);
const crossUVs = new Float32Array([
    0,0,  1,0,  0,1,
    1,0,  1,1,  0,1,
    0,0,  1,0,  0,1,
    1,0,  1,1,  0,1
]);
crossGeo.setAttribute('position', new THREE.BufferAttribute(crossPositions, 3));
crossGeo.setAttribute('uv', new THREE.BufferAttribute(crossUVs, 2));
crossGeo.computeVertexNormals();

const worldSeed = Math.random(); 
noise.seed(worldSeed);

const mapOffsetX = Math.floor(Math.random() * 1000000);
const mapOffsetZ = Math.floor(Math.random() * 1000000);

const activeChunks = {};
const chunkQueue = []; 
const interactableMeshes = [];
const brokenBlocks = new Set(); 
const placedBlocks = new Map(); // <-- Our new memory bank for placed blocks!
const chunksToRebuild = new Set(); 

const TYPE = { 
    stone: 1, dirt: 2, grass_block: 3, sand: 4, sandstone: 5, snow_block: 6, snowy_grass_block: 7, 
    coal_ore: 8, iron_ore: 9, copper_ore: 10, gold_ore: 11, redstone_ore: 12, emerald_ore: 13, lapis_ore: 14, 
    diamond_ore: 15, deepslate: 16, bedrock: 17, deepslate_coal_ore: 18, deepslate_iron_ore: 19, 
    deepslate_copper_ore: 20, deepslate_gold_ore: 21, deepslate_redstone_ore: 22, 
    deepslate_emerald_ore: 23, deepslate_lapis_ore: 24, deepslate_diamond_ore: 25,
    oak_log: 26, oak_leaves: 27, spruce_log: 28, spruce_leaves: 29, oak_sapling: 30, spruce_sapling: 31,
    cobblestone: 32, cobbled_deepslate: 33 // Added missing placeable blocks!
};
const REVERSE_TYPE = [
    null, 'stone', 'dirt', 'grass_block', 'sand', 'sandstone', 'snow_block', 'snowy_grass_block', 
    'coal_ore', 'iron_ore', 'copper_ore', 'gold_ore', 'redstone_ore', 'emerald_ore', 'lapis_ore', 'diamond_ore', 
    'deepslate', 'bedrock', 'deepslate_coal_ore', 'deepslate_iron_ore', 'deepslate_copper_ore', 
    'deepslate_gold_ore', 'deepslate_redstone_ore', 'deepslate_emerald_ore', 'deepslate_lapis_ore', 
    'deepslate_diamond_ore', 'oak_log', 'oak_leaves', 'spruce_log', 'spruce_leaves', 'oak_sapling', 'spruce_sapling',
    'cobblestone', 'cobbled_deepslate' // Added missing placeable blocks!
];

function getGlobalBlock(gx, gy, gz) {
    if (gy < minworldY || gy >= minworldY + worldHeight) return null;
    let cx = Math.floor(gx / chunkSize);
    let cz = Math.floor(gz / chunkSize);
    let chunkId = `${cx},${cz}`;
    let chunk = activeChunks[chunkId];
    if (!chunk) return null; 
    
    let lx = gx - (cx * chunkSize);
    let lz = gz - (cz * chunkSize);
    let ly = gy - minworldY;
    
    let idx = lx + lz * chunkSize + ly * (chunkSize * chunkSize);
    return chunk.blocks[idx];
}

function setGlobalBlock(gx, gy, gz, type) {
    if (gy < minworldY || gy >= minworldY + worldHeight) return;
    
    // Memory Bank Update: Always record the change before messing with chunks
    let blockKey = `${gx},${gy},${gz}`;
    if (type === 0) {
        brokenBlocks.add(blockKey);
        placedBlocks.delete(blockKey); // If we break a block we placed, remove it from placed memory
    } else {
        brokenBlocks.delete(blockKey);
        placedBlocks.set(blockKey, type); // Save the block forever!
    }

    let cx = Math.floor(gx / chunkSize);
    let cz = Math.floor(gz / chunkSize);
    let chunkId = `${cx},${cz}`;
    let chunk = activeChunks[chunkId];
    
    // If the chunk happens to be unloaded when we place/break something (like a growing tree over the border)
    // We safely return. Since we already saved it in `placedBlocks`, it will build correctly when we walk over there!
    if (!chunk) return; 
    
    let lx = gx - (cx * chunkSize);
    let lz = gz - (cz * chunkSize);
    let ly = gy - minworldY;
    let idx = lx + lz * chunkSize + ly * (chunkSize * chunkSize);
    
    if (chunk.blocks[idx] !== type) {
        chunk.blocks[idx] = type;
    }
    
    chunksToRebuild.add(chunkId);
    if (lx === 0) chunksToRebuild.add(`${cx - 1},${cz}`);
    if (lx === chunkSize - 1) chunksToRebuild.add(`${cx + 1},${cz}`);
    if (lz === 0) chunksToRebuild.add(`${cx},${cz - 1}`);
    if (lz === chunkSize - 1) chunksToRebuild.add(`${cx},${cz + 1}`);
}

function doRandomTicks() {
    for (const chunkId in activeChunks) {
        const chunk = activeChunks[chunkId];
        if (!chunk || !chunk.blocks) continue;

        const [cx, cz] = chunkId.split(',').map(Number);
        
        for (let i = 0; i < 250; i++) {
            let lx = Math.floor(Math.random() * chunkSize);
            let lz = Math.floor(Math.random() * chunkSize);
            let ly = Math.floor(Math.random() * worldHeight);
            
            let idx = lx + lz * chunkSize + ly * (chunkSize * chunkSize);
            let blockType = chunk.blocks[idx];

            if (blockType === TYPE.grass_block || blockType === TYPE.snowy_grass_block) {
                let gx = (cx * chunkSize) + lx;
                let gy = ly + minworldY;
                let gz = (cz * chunkSize) + lz;

                let above = getGlobalBlock(gx, gy + 1, gz);
                
                if (above !== null && above !== 0 && above !== TYPE.oak_leaves && above !== TYPE.spruce_leaves && above !== TYPE.snow_block && above !== TYPE.oak_sapling && above !== TYPE.spruce_sapling) {
                    setGlobalBlock(gx, gy, gz, TYPE.dirt);
                } 
                else if (above === 0 || above === TYPE.oak_leaves || above === TYPE.spruce_leaves || above === TYPE.snow_block) {
                    let ox = Math.floor(Math.random() * 3) - 1; 
                    let oz = Math.floor(Math.random() * 3) - 1;
                    let oy = Math.floor(Math.random() * 5) - 3; 
                    
                    let tx = gx + ox;
                    let ty = gy + oy;
                    let tz = gz + oz;
                    
                    let target = getGlobalBlock(tx, ty, tz);
                    if (target === TYPE.dirt) {
                        let targetAbove = getGlobalBlock(tx, ty + 1, tz);
                        if (targetAbove === 0 || targetAbove === TYPE.oak_leaves || targetAbove === TYPE.spruce_leaves || targetAbove === TYPE.snow_block || targetAbove === TYPE.oak_sapling || targetAbove === TYPE.spruce_sapling) {
                            setGlobalBlock(tx, ty, tz, blockType);
                        }
                    }
                }
            } else if (blockType === TYPE.oak_sapling || blockType === TYPE.spruce_sapling) {
                // Tree Growth! (Roughly a 1% chance per random tick to grow)
                if (Math.random() < 0.01) {
                    let gx = (cx * chunkSize) + lx;
                    let gy = ly + minworldY;
                    let gz = (cz * chunkSize) + lz;
                    growTreeDynamic(gx, gy, gz, blockType === TYPE.oak_sapling ? 'oak' : 'spruce');
                }
            }
        }
    }
}

// Function to dynamically push a new tree into the world data
function growTreeDynamic(x, y, z, treeType) {
    setGlobalBlock(x, y, z, 0); // Clear sapling
    
    const trunkH = treeType === 'spruce' ? 6 + Math.floor(Math.random() * 4) : 4 + Math.floor(Math.random() * 2);
    const logType = TYPE[`${treeType}_log`];
    const leavesType = TYPE[`${treeType}_leaves`];

    // TRUNK
    for (let i = 0; i < trunkH; i++) {
        setGlobalBlock(x, y + i, z, logType);
    }

    // LEAVES
    if (treeType === 'spruce') {
        let leafHeight = trunkH - (1 + Math.floor(Math.random() * 2));
        let leafStart = y + trunkH - leafHeight;
        let topY = y + trunkH + 1;
        let currentRadius = 0; 
        
        for (let ly = topY; ly >= leafStart; ly--) {
            for (let lx = -currentRadius; lx <= currentRadius; lx++) {
                for (let lz = -currentRadius; lz <= currentRadius; lz++) {
                    if (Math.abs(lx) === currentRadius && Math.abs(lz) === currentRadius && currentRadius > 0) {
                        if (currentRadius === 2) continue; 
                        if (currentRadius === 1 && ly === topY - 1) continue; 
                    }
                    if (lx === 0 && lz === 0 && ly < y + trunkH) continue; 
                    
                    let bX = x + lx; let bY = ly; let bZ = z + lz;
                    if (getGlobalBlock(bX, bY, bZ) === 0) {
                        setGlobalBlock(bX, bY, bZ, leavesType);
                    }
                }
            }
            if (currentRadius === 0) currentRadius = 1; 
            else if (currentRadius === 1 && ly < topY - 1) currentRadius = 2; 
            else if (currentRadius === 2) currentRadius = 1; 
        }
    } else {
        for (let ly = y + trunkH - 3; ly <= y + trunkH + 1; ly++) {
            let radius = (ly > y + trunkH - 1) ? 1 : 2; 
            for (let lx = -radius; lx <= radius; lx++) {
                for (let lz = -radius; lz <= radius; lz++) {
                    if (Math.abs(lx) === radius && Math.abs(lz) === radius) {
                        let trimChance = (ly === y + trunkH + 1) ? 1.0 : (ly === y + trunkH) ? 0.75 : 0.2;
                        if (Math.random() < trimChance) continue;
                    }
                    if (lx === 0 && lz === 0 && ly < y + trunkH) continue;
                    
                    let bX = x + lx; let bY = ly; let bZ = z + lz;
                    if (getGlobalBlock(bX, bY, bZ) === 0) {
                        setGlobalBlock(bX, bY, bZ, leavesType);
                    }
                }
            }
        }
    }
}

function getBiome(temp, moist, depth) {
    let closestBiome = BIOME_REGISTRY[0];
    let minDist = Infinity;
    for (let b of BIOME_REGISTRY) {
        let dist = (temp - b.temp)*(temp - b.temp) + (moist - b.moist)*(moist - b.moist);
        if (dist < minDist) { minDist = dist; closestBiome = b; }
    }
    return closestBiome;
}

function getInterpolatedHeightScale(x, z) {
    const range = 8; 
    const step = 4; 
    let totalScale = 0; 
    let samples = 0;
    
    for (let offX = -range; offX <= range; offX += step) {
        for (let offZ = -range; offZ <= range; offZ += step) {
            let temp = fbm2(x + offX + mapOffsetX, z + offZ + mapOffsetZ, 2, 400);
            let moist = fbm2(x + offX + mapOffsetX + 10000, z + offZ + mapOffsetZ + 10000, 2, 400);
            totalScale += getBiome(temp, moist, 0).heightScale;
            samples++;
        }
    }
    return totalScale / samples; 
}

function getDeterministicRandom(x, y, z) {
    let str = `${x},${y},${z},${worldSeed}`;
    let h = 2166136261; 
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

function spawnTree(x, y, z, chunkMeshes, indices, treeType = 'oak') {
    const trunkH = treeType === 'spruce' 
        ? 6 + Math.floor(getDeterministicRandom(x, y, z) * 4) 
        : 4 + Math.floor(getDeterministicRandom(x, y, z) * 2);
        
    const treeMatrix = new THREE.Matrix4();
    const logType = `${treeType}_log`;
    const leavesType = `${treeType}_leaves`;
    
    // TRUNK
    for (let i = 0; i < trunkH; i++) {
        let actualY = y + i;
        let blockKey = `${x},${actualY},${z}`;
        // Skip logs if the player placed or broke something here!
        if (brokenBlocks.has(blockKey) || placedBlocks.has(blockKey)) continue;
        treeMatrix.setPosition(x, actualY, z);
        chunkMeshes[logType].setMatrixAt(indices[logType]++, treeMatrix);
    }

    // LEAVES
    if (treeType === 'spruce') {
        let leafHeight = trunkH - (1 + Math.floor(getDeterministicRandom(x, y, z) * 2));
        let leafStart = y + trunkH - leafHeight;
        let topY = y + trunkH + 1;
        let currentRadius = 0; 
        
        for (let ly = topY; ly >= leafStart; ly--) {
            for (let lx = -currentRadius; lx <= currentRadius; lx++) {
                for (let lz = -currentRadius; lz <= currentRadius; lz++) {
                    if (Math.abs(lx) === currentRadius && Math.abs(lz) === currentRadius && currentRadius > 0) {
                        if (currentRadius === 2) continue; 
                        if (currentRadius === 1 && ly === topY - 1) continue; 
                    }
                    
                    if (lx === 0 && lz === 0 && ly < y + trunkH) continue; 
                    
                    const bX = x + lx; const bY = ly; const bZ = z + lz;
                    let blockKey = `${bX},${bY},${bZ}`;
                    // Skip leaves if the player modified this spot
                    if (brokenBlocks.has(blockKey) || placedBlocks.has(blockKey)) continue;

                    treeMatrix.setPosition(bX, bY, bZ);
                    chunkMeshes[leavesType].setMatrixAt(indices[leavesType]++, treeMatrix);
                }
            }
            
            if (currentRadius === 0) {
                currentRadius = 1; 
            } else if (currentRadius === 1 && ly < topY - 1) {
                currentRadius = 2; 
            } else if (currentRadius === 2) {
                currentRadius = 1; 
            }
        }
    } else {
        for (let ly = y + trunkH - 3; ly <= y + trunkH + 1; ly++) {
            let radius = (ly > y + trunkH - 1) ? 1 : 2; 
            for (let lx = -radius; lx <= radius; lx++) {
                for (let lz = -radius; lz <= radius; lz++) {
                    if (Math.abs(lx) === radius && Math.abs(lz) === radius) {
                        let trimChance = (ly === y + trunkH + 1) ? 1.0 : (ly === y + trunkH) ? 0.75 : 0.2;
                        if (getDeterministicRandom(x + lx, ly, z + lz) < trimChance) continue;
                    }
                    if (lx === 0 && lz === 0 && ly < y + trunkH) continue;
                    
                    const bX = x + lx; const bY = ly; const bZ = z + lz;
                    let blockKey = `${bX},${bY},${bZ}`;
                    // Skip leaves if the player modified this spot
                    if (brokenBlocks.has(blockKey) || placedBlocks.has(blockKey)) continue;

                    treeMatrix.setPosition(bX, bY, bZ);
                    chunkMeshes[leavesType].setMatrixAt(indices[leavesType]++, treeMatrix);
                }
            }
        }
    }
}

// ----------------------------------------------------
// 4. Chunk Generator
// ----------------------------------------------------
function fbm2(x, z, octaves = 4, scale = 400) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    for(let i = 0; i < octaves; i++) {
        total += noise.perlin2((x / scale) * frequency, (z / scale) * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return total / maxValue;
}

function fbm3(x, y, z, octaves = 2, scale = 40) {
    let total = 0, frequency = 1, amplitude = 1, maxValue = 0;
    for(let i = 0; i < octaves; i++) {
        total += noise.perlin3((x / scale) * frequency, (y / scale) * frequency, (z / scale) * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return total / maxValue;
}

function generateChunk(chunkX, chunkZ) {
    const chunkId = `${chunkX},${chunkZ}`;
    if (activeChunks[chunkId]) return;

    const startX = chunkX * chunkSize;
    const startZ = chunkZ * chunkSize;
    const maxVisibleBlocks = 25000; 

    const meshes = {};
    const indices = {};
    for (const [key, mat] of Object.entries(materials)) {
        let geo = (key === 'oak_sapling' || key === 'spruce_sapling') ? crossGeo : geometry;
        meshes[key] = new THREE.InstancedMesh(geo, mat, maxVisibleBlocks);
        meshes[key].name = key;
        meshes[key].chunkId = chunkId;
        meshes[key].instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        // Added instance color attribute for Lighting Engine!
        meshes[key].instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxVisibleBlocks * 3), 3);
        indices[key] = 0;
    }

    const blocks = new Uint8Array(chunkSize * chunkSize * worldHeight);
    const getIdx = (x, y, z) => x + z * chunkSize + y * (chunkSize * chunkSize);
    const treesToSpawn = [];

    // PASS 1: DATA GENERATION
    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            let globalX = startX + x;
            let globalZ = startZ + z;

            let tempMap = fbm2(globalX + mapOffsetX, globalZ + mapOffsetZ, 2, 400);
            let moistMap = fbm2(globalX + mapOffsetX + 10000, globalZ + mapOffsetZ + 10000, 2, 400);
            
            let biomeJitterX = noise.perlin2(globalX / 8, globalZ / 8) * 0.08;
            let biomeJitterZ = noise.perlin2(globalX / 8 + 5000, globalZ / 8 + 5000) * 0.08;
            
            let localBiome = getBiome(tempMap + biomeJitterX, moistMap + biomeJitterZ, 0); 
            
            let blendedScale = getInterpolatedHeightScale(globalX, globalZ);
            let rawElevation = fbm2(globalX + mapOffsetX, globalZ + mapOffsetZ, 4, 300);
            let baseHeight = ((rawElevation + 1) / 2) * blendedScale + 62;

            for (let y = 0; y < worldHeight; y++) {
                let actualY = y + minworldY;
                let blockIdx = getIdx(x, y, z);
                let blockKey = `${globalX},${actualY},${globalZ}`;

                // VERY FIRST THING: Check if the player manually placed or broke something here!
                if (placedBlocks.has(blockKey)) {
                    blocks[blockIdx] = placedBlocks.get(blockKey);
                    continue; // Skip the natural math generator
                }
                if (brokenBlocks.has(blockKey)) {
                    blocks[blockIdx] = 0; // Make sure it stays empty air
                    continue; // Skip the natural math generator
                }

                let cliffNoise = noise.perlin3(globalX / 50, actualY / 40, globalZ / 50) * 18;
                let detailNoise = noise.perlin3(globalX / 15, actualY / 15, globalZ / 15) * 5;
                let density = (baseHeight - actualY) + cliffNoise + detailNoise;

                if (density > 0) {
                    if (actualY <= minworldY + 4) {
                        if (getDeterministicRandom(globalX, actualY, globalZ) < ((minworldY + 5) - actualY) / 5) {
                            blocks[blockIdx] = TYPE.bedrock; continue;
                        }
                    }

                    let actualYAbove = actualY + 1;
                    let densityAbove = (baseHeight - actualYAbove) + 
                                       (noise.perlin3(globalX / 50, actualYAbove / 40, globalZ / 50) * 18) + 
                                       (noise.perlin3(globalX / 15, actualYAbove / 15, globalZ / 15) * 5);

                    let stoneType = actualY < 8 + (noise.perlin2(globalX / 16, globalZ / 16) * 4) ? 'deepslate' : 'stone';
                    
                    if (stoneType === 'stone' && densityAbove < 10 && localBiome.deepSubBlock !== 'stone') {
                        stoneType = localBiome.deepSubBlock;
                    }

                    let isCave = (fbm3(globalX, actualY, globalZ, 2, 35)**2 + fbm3(globalX+1000, actualY+1000, globalZ+1000, 2, 35)**2) < 0.005;

                    if (isCave) continue;

                    let baseBlockType = stoneType;
                    if (densityAbove <= 0) { 
                        baseBlockType = actualY > 100 ? 'snow' : localBiome.topBlock;
                    } else if (densityAbove < 3) {
                        baseBlockType = localBiome.subBlock;
                    }

                    let blockType = baseBlockType;

                    if (baseBlockType === 'stone' || baseBlockType === 'deepslate') {
                        let foundOre = false;
                        let oreIndex = 0; 
                        
                        for (const [oreName, rules] of Object.entries(ORE_CONFIG)) {
                            if (foundOre) break;
                            oreIndex++; 
                            
                            for (const conf of rules) {
                                if (actualY >= conf.min && actualY <= conf.max) {
                                    let offset = (oreIndex * 1000); 
                                    let veinNoise = noise.perlin3((globalX + offset) * 0.25, (actualY + offset) * 0.25, (globalZ + offset) * 0.25);
                                    
                                    let currentThreshold = conf.threshold;
                                    
                                    if (conf.peak !== undefined) {
                                        let maxDist = Math.max(Math.abs(conf.max - conf.peak), Math.abs(conf.min - conf.peak));
                                        let dist = Math.abs(actualY - conf.peak);
                                        let penalty = (dist / maxDist) * 0.15; 
                                        currentThreshold += penalty;
                                    }
                                    
                                    if (veinNoise > currentThreshold) {
                                        blockType = (baseBlockType === 'deepslate') ? `deepslate_${oreName}` : oreName;
                                        foundOre = true; break;
                                    }
                                }
                            }
                        }
                    }

                    blocks[blockIdx] = TYPE[blockType] || TYPE.stone;
                }
            } 

            for (let y = worldHeight - 1; y >= 0; y--) {
                let b = blocks[getIdx(x, y, z)];
                if (b !== 0) { 
                    if ((b === TYPE.grass_block || b === TYPE.snowy_grass_block) && localBiome.treeChance > 0) {
                        let actualY = y + minworldY;
                        if (getDeterministicRandom(globalX, actualY, globalZ) < localBiome.treeChance) {
                            treesToSpawn.push({ x, y, z, actualY, treeType: localBiome.treeType });
                        }
                    }
                    break; 
                }
            }
        }
    }

    // NEW ENGINE FEATURE: Build Chunk Heightmap for Lighting
    const heightMap = new Int16Array(chunkSize * chunkSize);
    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            let hY = worldHeight - 1;
            while (hY >= 0) {
                let b = blocks[getIdx(x, hY, z)];
                // Ignore transparent blocks so sunlight passes through leaves/saplings!
                if (b !== 0 && b !== TYPE.oak_leaves && b !== TYPE.spruce_leaves && b !== TYPE.oak_sapling && b !== TYPE.spruce_sapling) break;
                hY--;
            }
            heightMap[x + z * chunkSize] = hY + minworldY;
        }
    }

    // PASS 2: MESH GENERATION & CULLING
    const matrix = new THREE.Matrix4();
    const colorObj = new THREE.Color();
    
    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            for (let y = 0; y < worldHeight; y++) {
                let typeId = blocks[getIdx(x, y, z)];
                if (typeId === 0) continue;
                let actualY = y + minworldY;

                const isOpen = (nx, ny, nz) => {
                    if (ny < 0 || ny >= worldHeight) return true;
                    if (nx >= 0 && nx < chunkSize && nz >= 0 && nz < chunkSize) {
                        let b = blocks[nx + nz * chunkSize + ny * (chunkSize * chunkSize)];
                        return b === 0 || b === TYPE.oak_leaves || b === TYPE.spruce_leaves || b === TYPE.snow_block || b === TYPE.oak_sapling || b === TYPE.spruce_sapling;
                    }
                    let gx = startX + nx; let gy = ny + minworldY; let gz = startZ + nz;
                    let b = getGlobalBlock(gx, gy, gz);
                    if (b === null) return true; 
                    return b === 0 || b === TYPE.oak_leaves || b === TYPE.spruce_leaves || b === TYPE.snow_block || b === TYPE.oak_sapling || b === TYPE.spruce_sapling;
                };

                let isVisible = isOpen(x-1, y, z) || isOpen(x+1, y, z) ||
                                isOpen(x, y-1, z) || isOpen(x, y+1, z) ||
                                isOpen(x, y, z-1) || isOpen(x, y, z+1);

                if (isVisible) {
                    let bName = REVERSE_TYPE[typeId];
                    if (meshes[bName]) {
                        
                        // MINECRAFT LIGHT LEVEL CALCULATION!
                        let localHighest = heightMap[x + z * chunkSize];
                        let lowestAdjacentH = localHighest;
                        // Check side block heights to let light spill down cliffs
                        if (x > 0) lowestAdjacentH = Math.min(lowestAdjacentH, heightMap[(x-1) + z * chunkSize]);
                        if (x < chunkSize - 1) lowestAdjacentH = Math.min(lowestAdjacentH, heightMap[(x+1) + z * chunkSize]);
                        if (z > 0) lowestAdjacentH = Math.min(lowestAdjacentH, heightMap[x + (z-1) * chunkSize]);
                        if (z < chunkSize - 1) lowestAdjacentH = Math.min(lowestAdjacentH, heightMap[x + (z+1) * chunkSize]);

                        let lightLevel = 1.0;
                        if (actualY <= lowestAdjacentH) {
                            let depth = lowestAdjacentH - actualY;
                            lightLevel = Math.max(0.08, 0.85 - (depth * 0.15)); // Deeper = Darker
                        }
                        colorObj.setRGB(lightLevel, lightLevel, lightLevel);

                        matrix.setPosition(startX + x, actualY, startZ + z);
                        meshes[bName].setMatrixAt(indices[bName], matrix);
                        meshes[bName].setColorAt(indices[bName], colorObj); // Apply shade!
                        indices[bName]++;

                        if (bName === 'grass_block' && meshes['grass_block_overlay']) {
                            meshes['grass_block_overlay'].setMatrixAt(indices['grass_block_overlay'], matrix);
                            meshes['grass_block_overlay'].setColorAt(indices['grass_block_overlay'], colorObj);
                            indices['grass_block_overlay']++;
                        }
                    }
                }
            }
        }
    }

    for (let t of treesToSpawn) spawnTree(startX + t.x, t.actualY + 1, startZ + t.z, meshes, indices, t.treeType);

    for (const key in meshes) {
        meshes[key].count = indices[key];
        meshes[key].instanceMatrix.needsUpdate = true;
        if (meshes[key].instanceColor) meshes[key].instanceColor.needsUpdate = true;
        meshes[key].computeBoundingSphere(); // FIX: Allows Raycaster to correctly find newly placed blocks!
        scene.add(meshes[key]);
        
        if (key !== 'grass_block_overlay') {
            interactableMeshes.push(meshes[key]);
        }
    }
    
    activeChunks[chunkId] = { meshes, blocks, treesToSpawn };
}

// ----------------------------------------------------
// 4.5. Chunk Rebuilding (Unculling)
// ----------------------------------------------------
function rebuildChunkGeometry(chunkX, chunkZ) {
    const chunkId = `${chunkX},${chunkZ}`;
    const chunkData = activeChunks[chunkId];
    if (!chunkData) return;

    const { meshes, blocks, treesToSpawn } = chunkData;
    const startX = chunkX * chunkSize;
    const startZ = chunkZ * chunkSize;
    const getIdx = (x, y, z) => x + z * chunkSize + y * (chunkSize * chunkSize);

    const indices = {};
    for (const key in meshes) indices[key] = 0;

    const matrix = new THREE.Matrix4();
    const colorObj = new THREE.Color();

    // Rebuild Heightmap
    const heightMap = new Int16Array(chunkSize * chunkSize);
    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            let hY = worldHeight - 1;
            while (hY >= 0) {
                let b = blocks[getIdx(x, hY, z)];
                let globalX = startX + x;
                let actualY = hY + minworldY;
                let globalZ = startZ + z;
                
                // Pretend broken blocks are air for the sunlight
                if (brokenBlocks.has(`${globalX},${actualY},${globalZ}`)) {
                    hY--; continue; 
                }
                if (b !== 0 && b !== TYPE.oak_leaves && b !== TYPE.spruce_leaves && b !== TYPE.oak_sapling && b !== TYPE.spruce_sapling) break;
                hY--;
            }
            heightMap[x + z * chunkSize] = hY + minworldY;
        }
    }

    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            for (let y = 0; y < worldHeight; y++) {
                let typeId = blocks[getIdx(x, y, z)];
                if (typeId === 0) continue;

                let globalX = startX + x;
                let actualY = y + minworldY;
                let globalZ = startZ + z;

                if (brokenBlocks.has(`${globalX},${actualY},${globalZ}`)) continue;

                const isOpen = (nx, ny, nz) => {
                    if (ny < 0 || ny >= worldHeight) return true;
                    if (nx >= 0 && nx < chunkSize && nz >= 0 && nz < chunkSize) {
                        let b = blocks[nx + nz * chunkSize + ny * (chunkSize * chunkSize)];
                        return b === 0 || b === TYPE.oak_leaves || b === TYPE.spruce_leaves || b === TYPE.snow_block || b === TYPE.oak_sapling || b === TYPE.spruce_sapling;
                    }
                    let b = getGlobalBlock(startX + nx, ny + minworldY, startZ + nz);
                    if (b === null) return true; 
                    return b === 0 || b === TYPE.oak_leaves || b === TYPE.spruce_leaves || b === TYPE.snow_block || b === TYPE.oak_sapling || b === TYPE.spruce_sapling;
                };

                let isVisible = isOpen(x-1, y, z) || isOpen(x+1, y, z) ||
                                isOpen(x, y-1, z) || isOpen(x, y+1, z) ||
                                isOpen(x, y, z-1) || isOpen(x, y, z+1);

                if (isVisible) {
                    let bName = REVERSE_TYPE[typeId];
                    if (meshes[bName]) {
                        
                        // Calculate lighting
                        let localHighest = heightMap[x + z * chunkSize];
                        let lowestAdjacentH = localHighest;
                        if (x > 0) lowestAdjacentH = Math.min(lowestAdjacentH, heightMap[(x-1) + z * chunkSize]);
                        if (x < chunkSize - 1) lowestAdjacentH = Math.min(lowestAdjacentH, heightMap[(x+1) + z * chunkSize]);
                        if (z > 0) lowestAdjacentH = Math.min(lowestAdjacentH, heightMap[x + (z-1) * chunkSize]);
                        if (z < chunkSize - 1) lowestAdjacentH = Math.min(lowestAdjacentH, heightMap[x + (z+1) * chunkSize]);

                        let lightLevel = 1.0;
                        if (actualY <= lowestAdjacentH) {
                            let depth = lowestAdjacentH - actualY;
                            lightLevel = Math.max(0.08, 0.85 - (depth * 0.15));
                        }
                        colorObj.setRGB(lightLevel, lightLevel, lightLevel);

                        matrix.setPosition(globalX, actualY, globalZ);
                        meshes[bName].setMatrixAt(indices[bName], matrix);
                        meshes[bName].setColorAt(indices[bName], colorObj);
                        indices[bName]++;

                        if (bName === 'grass_block' && meshes['grass_block_overlay']) {
                            meshes['grass_block_overlay'].setMatrixAt(indices['grass_block_overlay'], matrix);
                            meshes['grass_block_overlay'].setColorAt(indices['grass_block_overlay'], colorObj);
                            indices['grass_block_overlay']++;
                        }
                    }
                }
            }
        }
    }

    for (let t of treesToSpawn) spawnTree(startX + t.x, t.actualY + 1, startZ + t.z, meshes, indices, t.treeType);

    for (const key in meshes) {
        meshes[key].count = indices[key];
        meshes[key].instanceMatrix.needsUpdate = true;
        if (meshes[key].instanceColor) meshes[key].instanceColor.needsUpdate = true;
        meshes[key].computeBoundingSphere(); 
    }
}

// ----------------------------------------------------
// 5. Light & Engine Core (Day / Night Cycle)
// ----------------------------------------------------
// Setup Sun, Moon, and Sky variables
let timeOfDay = Math.PI / 2; // Start at exactly noon
const dayCycleSpeed = 0.05; // Make larger for faster days!

// Basic Global Light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
scene.add(ambientLight);

// The Sun Light
const sunLight = new THREE.DirectionalLight(0xffffee, 0.8);
scene.add(sunLight);

// The Sun Object
const sunGeo = new THREE.BoxGeometry(6, 6, 6);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffaa }); // Unlit material so it always glows
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
scene.add(sunMesh);

// The Moon Light
const moonLight = new THREE.DirectionalLight(0xaaccff, 0.2); // Faint blue light for night
scene.add(moonLight);

// The Moon Object
const moonGeo = new THREE.BoxGeometry(4, 4, 4);
const moonMat = new THREE.MeshBasicMaterial({ color: 0xddddff });
const moonMesh = new THREE.Mesh(moonGeo, moonMat);
scene.add(moonMesh);

// The Stars
const starsGeo = new THREE.BufferGeometry();
const starVertices = [];
for(let i=0; i<1500; i++) {
    // Spread stars out far around the player
    let x = THREE.MathUtils.randFloatSpread(300);
    let y = THREE.MathUtils.randFloatSpread(300);
    let z = THREE.MathUtils.randFloatSpread(300);
    // Cut out the center so stars don't float inside your face!
    if(Math.abs(x) > 50 || Math.abs(y) > 50 || Math.abs(z) > 50) {
        starVertices.push(x, y, z);
    }
}
starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
const starsMat = new THREE.PointsMaterial({color: 0xffffff, size: 0.8, transparent: true, opacity: 0}); // Start invisible
const starsMesh = new THREE.Points(starsGeo, starsMat);
scene.add(starsMesh);

function updateDayNightCycle(delta) {
    // Advance time
    timeOfDay += delta * dayCycleSpeed;
    if (timeOfDay > Math.PI * 2) timeOfDay -= Math.PI * 2;

    const orbitRadius = 150;
    
    // Move the Sun
    sunMesh.position.x = camera.position.x + Math.cos(timeOfDay) * orbitRadius;
    sunMesh.position.y = camera.position.y + Math.sin(timeOfDay) * orbitRadius;
    sunMesh.position.z = camera.position.z + 50; // Offset slightly so it's not perfectly overhead
    sunLight.position.copy(sunMesh.position);

    // Move the Moon (exactly opposite of the Sun)
    moonMesh.position.x = camera.position.x + Math.cos(timeOfDay + Math.PI) * orbitRadius;
    moonMesh.position.y = camera.position.y + Math.sin(timeOfDay + Math.PI) * orbitRadius;
    moonMesh.position.z = camera.position.z + 50;
    moonLight.position.copy(moonMesh.position);

    // Follow the player with the stars and slowly rotate them
    starsMesh.position.copy(camera.position);
    starsMesh.rotation.z = timeOfDay * 0.5;

    // Calculate sky colors based on the cycle (1 is noon, -1 is midnight, 0 is dawn/dusk)
    let cycle = Math.sin(timeOfDay); 
    let skyColor = new THREE.Color();

    if (cycle > 0.2) { 
        // --- DAY TIME ---
        skyColor.setHex(0x87ceeb); // Light Blue Sky
        ambientLight.intensity = 0.5;
        sunLight.intensity = 0.8;
        moonLight.intensity = 0;
        starsMat.opacity = 0; // Hide stars
    } 
    else if (cycle > 0.0) { 
        // --- SUNSET / SUNRISE ---
        let interp = cycle / 0.2; // 0 to 1 value
        skyColor.setHex(0xffaa00).lerp(new THREE.Color(0x87ceeb), interp); // Orange -> Blue
        ambientLight.intensity = 0.2 + (0.3 * interp);
        sunLight.intensity = 0.8 * interp; // Fade sun light out
        moonLight.intensity = 0;
        starsMat.opacity = 1 - interp; // Fade stars in
    } 
    else if (cycle > -0.2) { 
        // --- DUSK / DAWN ---
        let interp = Math.abs(cycle) / 0.2; // 0 to 1 value
        skyColor.setHex(0xffaa00).lerp(new THREE.Color(0x000011), interp); // Orange -> Dark Blue
        ambientLight.intensity = 0.2 - (0.1 * interp);
        sunLight.intensity = 0;
        moonLight.intensity = 0.2 * interp; // Fade moon light in
        starsMat.opacity = interp;
    } 
    else { 
        // --- NIGHT TIME ---
        skyColor.setHex(0x000011); // Super Dark Blue
        ambientLight.intensity = 0.1; // Dark! Cave blocks get pitch black now!
        sunLight.intensity = 0;
        moonLight.intensity = 0.2;
        starsMat.opacity = 1; // Stars fully visible
    }

    // Apply the sky color to the background and the fog so mountains look correct
    scene.fog.color.copy(skyColor);
    renderer.setClearColor(skyColor);
}

let lastPlayerChunkX = -999; let lastPlayerChunkZ = -999;

function updateChunks() {
    const pX = Math.floor(camera.position.x / chunkSize);
    const pZ = Math.floor(camera.position.z / chunkSize);

    if (pX === lastPlayerChunkX && pZ === lastPlayerChunkZ) return;
    lastPlayerChunkX = pX; lastPlayerChunkZ = pZ;

    const chunksToKeep = new Set();
    for (let x = pX - renderDistance; x <= pX + renderDistance; x++) {
        for (let z = pZ - renderDistance; z <= pZ + renderDistance; z++) {
            const id = `${x},${z}`;
            chunksToKeep.add(id);
            if (!activeChunks[id] && !chunkQueue.includes(id)) chunkQueue.push(id);
        }
    }

    for (const id in activeChunks) {
        if (!chunksToKeep.has(id)) {
            for (const mesh of Object.values(activeChunks[id].meshes)) {
                scene.remove(mesh);
                const i = interactableMeshes.indexOf(mesh);
                if (i > -1) interactableMeshes.splice(i, 1);
                mesh.dispose();
            }
            delete activeChunks[id];
        }
    }
}

// ----------------------------------------------------
// 6. Player, Controls, Mining & Placing
// ----------------------------------------------------
const spawnX = 0; const spawnZ = 0; let safeSpawnY = 127; 
for (let y = 127; y >= 0; y--) {
    let bs = getInterpolatedHeightScale(spawnX, spawnZ);
    let baseH = ((noise.perlin2(spawnX/400, spawnZ/400) + 1) / 2) * bs + 64; 
    if ((baseH - y) + (noise.perlin3(0, y/40, 0)*20) > 0) { safeSpawnY = y; break; }
}

camera.position.set(spawnX, safeSpawnY + 2, spawnZ);

// Custom hand
const handGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2); handGeo.translate(0, 0.4, 0); 
const playerHand = new THREE.Mesh(handGeo, new THREE.MeshStandardMaterial({ color: 0xd2a77d, roughness: 0.8 }));
playerHand.position.set(0.4, -0.4, -0.1);
playerHand.rotation.set(-Math.PI / 3, -Math.PI / 16, 0); 
camera.add(playerHand); scene.add(camera);

let yaw = 0, pitch = 0, keys = {};
let isLeftMouseDown = false; // Decoupled mouse tracker to prevent mining freeze/loops

const raycaster = new THREE.Raycaster(); raycaster.far = 6;
let mining = { active: false, startTime: 0, targetMesh: null, targetId: null, requiredTime: 500 };

// --- Dropped Items System ---
const droppedItems = [];
const itemGeometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);

function spawnDroppedItem(x, y, z, blockName) {
    if (!materials[blockName]) return; 
    let mat = materials[blockName];

    const mesh = new THREE.Mesh(itemGeometry, mat);
    mesh.position.set(x, y, z);
    
    // Give it a random physical "pop" out of the broken block
    const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        3 + Math.random() * 2,
        (Math.random() - 0.5) * 4
    );

    scene.add(mesh);
    droppedItems.push({ mesh, velocity, blockName, lifeTime: 0 });
}

function getTarget() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    const pX = Math.floor(camera.position.x / chunkSize);
    const pZ = Math.floor(camera.position.z / chunkSize);
    
    const nearbyMeshes = interactableMeshes.filter(m => {
        if (!m.chunkId) return false;
        const [cx, cz] = m.chunkId.split(',').map(Number);
        return Math.abs(cx - pX) <= 1 && Math.abs(cz - pZ) <= 1;
    });

    const hit = raycaster.intersectObjects(nearbyMeshes);
    return hit.length > 0 ? hit[0] : null;
}

function startMining(hit) {
    const blockName = hit.object.name;
    let requiredTime = BLOCK_HARDNESS[blockName] || 1000;

    // Bonus: Make mining 5x faster if holding the right tool!
    const heldItemType = inventory[selectedSlot].type;
    if (heldItemType && heldItemType.includes('pickaxe') && BLOCK_TOOL_REQUIREMENT[blockName] === 'pickaxe') {
        requiredTime /= 5; 
    }

    mining = { active: true, startTime: Date.now(), targetMesh: hit.object, targetId: hit.instanceId, requiredTime: requiredTime };
    destroyMat.map = destroyTextures[0]; destroyMat.needsUpdate = true;
    const mat = new THREE.Matrix4(); hit.object.getMatrixAt(hit.instanceId, mat);
    destroyMesh.position.setFromMatrixPosition(mat);
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
        // If we look at a new block while holding click, it'll seamlessly catch it next frame!
        return;
    }

    const elapsed = Date.now() - mining.startTime;
    const phase = Math.floor(Math.min(elapsed / mining.requiredTime, 1.0) * 9.99); 
    if (destroyMat.map !== destroyTextures[phase]) { 
        destroyMat.map = destroyTextures[phase]; 
        destroyMat.needsUpdate = true; 
    }

    if (elapsed >= mining.requiredTime) {
        const mat = new THREE.Matrix4(); 
        mining.targetMesh.getMatrixAt(mining.targetId, mat);
        const p = new THREE.Vector3().setFromMatrixPosition(mat);
        const blockName = mining.targetMesh.name; 
        
        setGlobalBlock(Math.round(p.x), Math.round(p.y), Math.round(p.z), 0);
        
        // --- Drop Logic ---
        const heldItemType = inventory[selectedSlot].type;
        const isHoldingPickaxe = heldItemType && heldItemType.includes('pickaxe');
        const requiresPickaxe = BLOCK_TOOL_REQUIREMENT[blockName] === 'pickaxe';

        if (!requiresPickaxe || isHoldingPickaxe) {
            const dropData = BLOCK_DROPS[blockName];

            if (dropData !== null) {
                const item = dropData?.item || blockName;
                let count = dropData?.count || 1;

                if (typeof count === 'function') count = count();

                for (let i = 0; i < count; i++) {
                    spawnDroppedItem(p.x, p.y, p.z, item);
                }
            }
        }
        
        if (mining.targetMesh && mining.targetMesh.chunkId) {
            chunksToRebuild.add(mining.targetMesh.chunkId);
        }

        // FIX: Cleanly end the mining sequence so it doesn't get stuck in a CPU loop finding the next block
        mining.active = false;
        destroyMesh.visible = false;
    }
}

// Stop right-click from opening the browser context menu
document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('mousedown', (e) => {
    // Prevent locking pointer if clicking the UI
    if (e.target.closest('#inventory-screen') || e.target.closest('#hotbar')) return; 
    
    if (!document.pointerLockElement && inventoryScreen.style.display === 'none') {
        renderer.domElement.requestPointerLock();
    } else if (document.pointerLockElement) {
        if (e.button === 0) {
            isLeftMouseDown = true; // Decoupled trigger to fix game-freeze bugs
        } else if (e.button === 2) { 
            // Right Click = Place Block
            const hit = getTarget(); 
            if (!hit) return;
            
            const mat = new THREE.Matrix4(); 
            hit.object.getMatrixAt(hit.instanceId, mat);
            const p = new THREE.Vector3().setFromMatrixPosition(mat);
            
            // Calculate empty space directly attached to the face you clicked
            const placeX = Math.round(p.x + hit.face.normal.x);
            const placeY = Math.round(p.y + hit.face.normal.y);
            const placeZ = Math.round(p.z + hit.face.normal.z);
            
            if (getGlobalBlock(placeX, placeY, placeZ) === 0) {
                const selectedItem = inventory[selectedSlot];
                
                if (selectedItem.type && TYPE[selectedItem.type]) {
                    setGlobalBlock(placeX, placeY, placeZ, TYPE[selectedItem.type]);
                    
                    // Consume the item from inventory!
                    selectedItem.count--;
                    if (selectedItem.count <= 0) {
                        selectedItem.type = null;
                        selectedItem.count = 0;
                    }
                    updateInventoryUI();
                }
            }
        }
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        isLeftMouseDown = false;
        mining.active = false;
        destroyMesh.visible = false;
    }
});

document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement) {
        yaw -= e.movementX * 0.002;
        pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch - e.movementY * 0.002));
    }
});

window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    
    // Open/Close Inventory with 'E'
    if (e.key.toLowerCase() === 'e') {
        if (inventoryScreen.style.display === 'none') {
            // Open Menu
            inventoryScreen.style.display = 'flex';
            crosshair.style.display = 'none';
            document.exitPointerLock();
            keys = {}; // Stop the player from continuously walking
        } else {
            // Close Menu
            inventoryScreen.style.display = 'none';
            crosshair.style.display = 'block';
            
            // Toss dragging item back into inventory if closed
            if (heldItem.type) {
                addItemToInventory(heldItem.type, heldItem.count);
                heldItem = { type: null, count: 0 };
                updateInventoryUI();
            }
            renderer.domElement.requestPointerLock();
        }
    }

    // Select hotbar slots with 1-9 number keys
    if (e.key >= '1' && e.key <= '9' && inventoryScreen.style.display === 'none') {
        selectedSlot = parseInt(e.key) - 1;
        updateInventoryUI();
    }
});

window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

// Cycle hotbar with mouse scroll wheel
let lastScrollTime = 0; // Tracks when you last scrolled
window.addEventListener('wheel', (e) => {
    if (document.pointerLockElement && inventoryScreen.style.display === 'none') {
        const now = Date.now();
        // 150ms cooldown prevents double-triggering
        if (now - lastScrollTime < 50) return; 
        lastScrollTime = now;

        if (e.deltaY > 0) {
            selectedSlot = (selectedSlot + 1) % 9;
        } else {
            selectedSlot = (selectedSlot - 1 + 9) % 9;
        }
        updateInventoryUI();
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ----------------------------------------------------
// 7. Loop
// ----------------------------------------------------
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta(); 

    updateChunks();
    updateDayNightCycle(delta); // Run our new weather system!

    if (chunkQueue.length > 0) {
        const next = chunkQueue.shift();
        const [cx, cz] = next.split(',').map(Number);
        generateChunk(cx, cz);
    }

    // Safely trigger mining on the main loop so it doesn't cause recursive freezing!
    if (isLeftMouseDown && !mining.active && document.pointerLockElement && inventoryScreen.style.display === 'none') {
        const hit = getTarget();
        if (hit) startMining(hit);
    }

    updateMining();
    doRandomTicks();

    for (let chunkId of chunksToRebuild) {
        let [cx, cz] = chunkId.split(',').map(Number);
        rebuildChunkGeometry(cx, cz);
    }
    chunksToRebuild.clear();
    
    // --- Update Dropped Items ---
    for (let i = droppedItems.length - 1; i >= 0; i--) {
        let item = droppedItems[i];
        item.lifeTime += delta;
        
        item.velocity.y -= 15 * delta; 
        
        // Calculate potential next position
        let nx = item.mesh.position.x + item.velocity.x * delta;
        let ny = item.mesh.position.y + item.velocity.y * delta;
        let nz = item.mesh.position.z + item.velocity.z * delta;

        let bX = Math.round(nx);
        let bY = Math.round(ny - 0.25); // Check the block right below the item
        let bZ = Math.round(nz);

        let blockBelow = getGlobalBlock(bX, bY, bZ);

        // 1. Unloaded Chunk Check (Freeze items so they don't fall into the void)
        if (blockBelow === null) {
            item.velocity.set(0, 0, 0);
            nx = item.mesh.position.x;
            ny = item.mesh.position.y;
            nz = item.mesh.position.z;
        } 
        // 2. Floor Collision
        else if (blockBelow !== 0) {
            ny = bY + 0.5 + 0.125; // Top of the block + half item size
            item.velocity.y = 0;
            item.velocity.x *= 0.5; // Friction slows it down
            item.velocity.z *= 0.5;
        } 
        // 3. Wall Collision (Prevent flying sideways into a wall and falling down)
        else {
            let wallBlock = getGlobalBlock(bX, Math.round(ny), bZ);
            if (wallBlock !== 0 && wallBlock !== null) {
                item.velocity.x *= -0.5; // Bounce back
                item.velocity.z *= -0.5;
                nx = item.mesh.position.x;
                nz = item.mesh.position.z;
            }
        }

        item.mesh.position.set(nx, ny, nz);

        item.mesh.rotation.y += delta * 2;
        // Make it bob up and down when resting on the ground
        if (item.velocity.y === 0) {
            item.mesh.position.y += Math.sin(item.lifeTime * 4) * 0.002;
        }
        
        const dist = camera.position.distanceTo(item.mesh.position);
        if (dist < 1.5) {
            scene.remove(item.mesh);
            item.mesh.geometry.dispose();
            droppedItems.splice(i, 1);
            addItemToInventory(item.blockName, 1);
        } else if (item.mesh.position.y < minworldY - 20) {
            // Despawn if it somehow falls deep into the void (Cleanup for lag)
            scene.remove(item.mesh);
            item.mesh.geometry.dispose();
            droppedItems.splice(i, 1);
        }
    }

    // Animate Hand
    if (mining.active) {
        const t = Date.now() * 0.025; 
        playerHand.rotation.x = (-Math.PI / 3) + Math.sin(t) * 0.25;
        playerHand.position.z = -0.2 + Math.cos(t) * 0.15;
        playerHand.position.y = -0.25 + Math.sin(t) * 0.04;
    } else {
        playerHand.rotation.x = THREE.MathUtils.lerp(playerHand.rotation.x, -Math.PI / 3, 0.2);
        playerHand.position.z = THREE.MathUtils.lerp(playerHand.position.z, -0.1, 0.2);
        playerHand.position.y = THREE.MathUtils.lerp(playerHand.position.y, -0.4, 0.2);
    }

    // --- Fly Mode Movement ---
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    const rgt = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    
    if (keys.w) camera.position.addScaledVector(fwd, -moveSpeed * delta);
    if (keys.s) camera.position.addScaledVector(fwd, moveSpeed * delta);
    if (keys.a) camera.position.addScaledVector(rgt, moveSpeed * delta);
    if (keys.d) camera.position.addScaledVector(rgt, -moveSpeed * delta);
    if (keys[' ']) camera.position.y += moveSpeed * delta;
    if (keys.shift) camera.position.y -= moveSpeed * delta;

    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    renderer.render(scene, camera);
    stats.update();
}

animate();
