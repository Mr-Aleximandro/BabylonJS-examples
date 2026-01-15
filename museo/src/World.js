/**
 * World.js - Main Scene Manager
 * Includes Advanced Collision, Multi-Room Layout, and Room-Based Optimization
 */

import { AssetManager } from './AssetManager.js'
import { Player } from './Player.js'
import { FirstPersonControls } from './FirstPersonControls.js'
import { PhysicsSystem, CollisionLayers, buildRoomAABB, resolveCameraObstruction } from './PhysicsSystem.js'

class World {
  constructor() {
    this.canvas = document.getElementById('renderCanvas');
    this.engine = null;
    this.scene = null;
    this.camera = null;
    this.player = null;
    this.controls = null;
    this.assetManager = new AssetManager();
    this.physics = null
    this.pipeline = null
    this.settings = null
    this.activeArtwork = null
    this.nearArtwork = null
    this.cinematic = {
      active: false,
      exiting: false,
      saved: null,
      targetAlpha: null,
      targetBeta: null,
      targetRadius: null,
      targetTarget: null,
    }
    
    // Game State
    this.cameraMode = 'THIRD_PERSON'; 
    this.isPaused = false;
    this.frameCount = 0; // Performance throttling
    this.startPosition = new BABYLON.Vector3(0, 0.9, 0); // Posición inicial del jugador
    this.gravity = -9.81
    this.physicsBroadphaseRadius = 28
    this.collisionDebug = false
    
    // Room Optimization System
    this.rooms = []; // { name, bounds: {min, max}, rootMesh, neighbors: [] }
    this.currentRoom = null;
    
    // Binding
    this.animate = this.animate.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);
  }

  async init() {
    this.initEngine();
    this.initScene();
    
    // Load assets
    await this.assetManager.init(this.scene);
    
    // Flag to enable/disable API fetch
    const USE_API = false;

    if (USE_API) {
        try {
          const res = await fetch('http://localhost:3000/api/space/1/structure')
          if (!res.ok) throw new Error(`API Error (${res.status})`)
          const data = await res.json()
          this.buildMuseumFromData(data)
          return
        } catch (e) {
          console.warn('Failed to load from API, using FALLBACK DATA', e)
        }
    } else {
        console.log('API Disabled. Using Local Data.')
    }
      
    const FALLBACK_DATA = {
          space: { name: 'Museo Demo (Offline)' },
          rooms: [
              { id: 1, name: 'Lobby',     posX: 0, posY: 0, posZ: 0, width: 80, height: 8, depth: 80, floorMat: 'floor_marble', wallMat: 'wall_stone', ceilingMat: 'ceiling' },
              { id: 2, name: 'Gallery 1', posX: 0, posY: 0, posZ: 51, width: 16, height: 6, depth: 20, floorMat: 'floor_wood', wallMat: 'wall_plaster', ceilingMat: 'ceiling' },
              { id: 3, name: 'Gallery 2', posX: 17, posY: 0, posZ: 51, width: 16, height: 6, depth: 16, floorMat: 'floor_onyx', wallMat: 'wall_stone', ceilingMat: 'ceiling' }
          ],
          connections: [
              { fromRoomId: 1, toRoomId: 2, direction: 'north' },
              { fromRoomId: 2, toRoomId: 1, direction: 'south' },
              { fromRoomId: 2, toRoomId: 3, direction: 'east' },
              { fromRoomId: 3, toRoomId: 2, direction: 'west' }
          ],
          items: [
              { name: 'Cuadro 1', posX: 0, posY: 0, posZ: 34, rotY: Math.PI, scale: 2, file: 'textures/misc.jpg', description: 'Una obra maestra del arte abstracto.' },
              { name: 'Cuadro 2', posX: -7.5, posY: 0, posZ: 25, rotY: Math.PI/2, scale: 1.5, file: 'textures/misc.jpg', description: 'Retrato de la soledad moderna.' },
              { name: 'Cuadro 3', posX: 20, posY: 0, posZ: 32.5, rotY: Math.PI, scale: 1.5, file: 'textures/misc.jpg', description: 'Paisaje onírico.' }
          ]
      }
      
      this.buildMuseumFromData(FALLBACK_DATA)
      // Remove loading text error if present
      const loadingText = document.querySelector('.loading-text')
      if (loadingText) loadingText.innerText = 'MODO OFFLINE ACTIVADO'
    
    
    this.initPlayer();
    this.initControls();
    
    // Start Loop
    this.engine.runRenderLoop(this.animate);
    window.addEventListener('resize', this.onWindowResize);
    
    // Hide Loading Screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.style.display = 'none';
  }

  initEngine() {
    this.engine = new BABYLON.Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true }, true);
  }

  initScene() {
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.collisionsEnabled = true;
    this.scene.gravity = new BABYLON.Vector3(0, this.gravity, 0);

    // Physics
    this.physics = new PhysicsSystem(this.scene, { cellSize: 8, nearRadius: this.physicsBroadphaseRadius });
    if (this.collisionDebug) this.physics.setDebugEnabled(true);
    
    // Performance Optimizations
    this.scene.skipPointerMovePicking = true;
    this.scene.constantlyUpdateMeshUnderPointer = false;
    this.scene.autoClear = false; // We rely on environment or background
    this.scene.autoClearDepthAndStencil = false; // Only clear if necessary
    
    // Basic Environment
    const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.78;
    hemi.diffuse = new BABYLON.Color3(1.0, 0.98, 0.95)
    hemi.groundColor = new BABYLON.Color3(0.25, 0.25, 0.28)

    // Shadow Generator
    const dir = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(0, -1, 0), this.scene);
    dir.position = new BABYLON.Vector3(0, 18, 0);
    dir.intensity = 0.35;
    
    this.shadowGenerator = new BABYLON.ShadowGenerator(1024, dir);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 16; // Reduced kernel size
    
    // Environment
    const envHelper = this.scene.createDefaultEnvironment({
       createSkybox: false,
       createGround: false,
       toneMappingEnabled: true,
    });
    if (envHelper) envHelper.primaryColor = new BABYLON.Color3(0.1, 0.1, 0.1);

    // Camera
    this.camera = new BABYLON.ArcRotateCamera("camera", -Math.PI/2, Math.PI/2.5, 5, new BABYLON.Vector3(0, 2, 0), this.scene);
    this.camera.attachControl(this.canvas, true);
    this.camera.keysUp = []
    this.camera.keysDown = []
    this.camera.keysLeft = []
    this.camera.keysRight = []
    this.camera.lowerBetaLimit = 0.25
    this.camera.upperBetaLimit = Math.PI - 0.25
    this.camera.minZ = 0.1;
    this.camera.wheelPrecision = 50;

    // Post Processing Pipeline
    this.pipeline = new BABYLON.DefaultRenderingPipeline("default", true, this.scene, [this.camera]);
    this.pipeline.bloomEnabled = true;
    this.pipeline.bloomThreshold = 0.8;
    this.pipeline.bloomWeight = 0.3;
    this.pipeline.bloomKernel = 64;
    this.pipeline.fxaaEnabled = true;
    this.pipeline.imageProcessingEnabled = true;
    this.pipeline.imageProcessing.contrast = 1.1;
    this.pipeline.imageProcessing.exposure = 1.0;
  }

  initPlayer() {
    this.player = new Player(this.scene);
    if (this.player?.mesh) {
      this.player.mesh.position.copyFrom(this.startPosition)
      this.player.mesh.position.y = Math.max(this.player.mesh.position.y, 2.0)
    }
  }

  initControls() {
    this.controls = new FirstPersonControls(this.player, this);
    this.controls.connect();
  }

  buildMuseumFromData(data) {
    const { space, rooms = [], items = [], connections = [] } = data || {};
    
    // We reuse the existing logic but map the DB fields to Babylon config
    console.log("Building Museum from DB:", space?.name || "Unknown");
    
    // --- MATERIALS LIBRARY (PBR for Hyperrealism) ---
    // (We keep the same material creation logic as before, just ensuring it's available)
    const materials = {};
    const createMat = (name, albedoPath, uScale=1, vScale=1, normalPath=null, roughPath=null, aoPath=null, metalPath=null, roughness=0.5, metallic=0.1) => {
        const mat = new BABYLON.PBRMaterial(name, this.scene);
        const tex = new BABYLON.Texture(albedoPath, this.scene);
        tex.uScale = uScale; tex.vScale = vScale;
        tex.gammaSpace = true; 
        mat.albedoTexture = tex;
        mat.useAmbientOcclusionFromMetallicTextureRed = false;
        mat.useRoughnessFromMetallicTextureGreen = false;
        mat.useMetallnessFromMetallicTextureBlue = false;
        
        if (normalPath) {
            const norm = new BABYLON.Texture(normalPath, this.scene);
            norm.uScale = uScale; norm.vScale = vScale;
            norm.gammaSpace = false; 
            mat.bumpTexture = norm;
        }
        if (roughPath) {
            const rough = new BABYLON.Texture(roughPath, this.scene);
            rough.uScale = uScale; rough.vScale = vScale;
            rough.gammaSpace = false; 
            mat.roughnessTexture = rough;
        } else {
            mat.roughness = roughness;
        }
        if (aoPath) {
            const ao = new BABYLON.Texture(aoPath, this.scene);
            ao.uScale = uScale; ao.vScale = vScale;
            ao.gammaSpace = false; 
            mat.ambientTexture = ao;
        }
        if (metalPath) {
            const metal = new BABYLON.Texture(metalPath, this.scene);
            metal.uScale = uScale; metal.vScale = vScale;
            metal.gammaSpace = false; 
            mat.metallicTexture = metal;
        } else {
            mat.metallic = metallic;
        }
        materials[name] = mat;
        return mat;
    };

    // Initialize Standard Materials
    createMat("asphalt_06_", "textures/asphalt_06/asphalt_06_diff_2k.jpg", 4, 4, 
        "textures/asphalt_06/asphalt_06_nor_gl_2k.jpg", 
        "textures/asphalt_06/asphalt_06_rough_2k.jpg", 
        "textures/asphalt_06/asphalt_06_ao_2k.jpg", 
        null, 1.0, 0.0
    );
    createMat("floor_onyx", "textures/Onyx015/Onyx015_2K-JPG_Color.jpg", 4, 4, 
        "textures/Onyx015/Onyx015_2K-JPG_NormalGL.jpg", 
        "textures/Onyx015/Onyx015_2K-JPG_Roughness.jpg", 
        null, null, 0.1, 0.0
    );
    createMat("floor_marble", "./textures/Onyx015/Onyx015_2K-JPG_Color.jpg", 4, 4, null, null, null, null, 0.1, 0.1); 
    createMat("floor_wood", "./textures/wood.jpg", 6, 6, null, null, null, null, 0.4, 0.0);
    createMat("wall_stone", "./textures/asphalt_06/asphalt_06_diff_2k.jpg", 3, 3, null, null, null, null, 0.8, 0.0); 
    createMat("wall_plaster", "./textures/crate.png", 4, 2, null, null, null, null, 0.9, 0.0);
    createMat("ceiling", "./textures/asphalt_06/asphalt_06_diff_2k.jpg", 5, 5, null, null, null, null, 0.9, 0.0);
    createMat("floor_grass", "./textures/grass.jpg", 10, 10, null, null, null, null, 0.8, 0.0);

    // --- HELPER FUNCTIONS ---
    const createRoom = (config) => {
        const { name, pos, size, options = {} } = config;
        const root = new BABYLON.TransformNode(name + "_root", this.scene);
        const w = size.w;
        const h = size.h;
        const d = size.d;
        const bounds = {
            min: new BABYLON.Vector3(pos.x - w/2, pos.y, pos.z - d/2),
            max: new BABYLON.Vector3(pos.x + w/2, pos.y + h, pos.z + d/2)
        };

        const createSurfaceWithHole = (type, width, depth, yPos, matName, hole) => {
            if (!hole) {
                const ground = BABYLON.MeshBuilder.CreateGround(name + "_" + type, { width: width, height: depth }, this.scene);
                ground.position.set(pos.x, yPos, pos.z);
                if (type === "ceiling") ground.rotation.x = Math.PI;
                ground.material = materials[matName];
                ground.checkCollisions = true;
                ground.receiveShadows = true;
                if (this.shadowGenerator) this.shadowGenerator.addShadowCaster(ground);
                ground.parent = root;
                return;
            }
            // Hole Logic (same as before)
            const hx = hole.x; const hz = hole.z; const hw = hole.w; const hd = hole.d;
            const parts = [];
            const nDepth = (depth/2) - (hz + hd/2);
            if (nDepth > 0.01) {
                const nPart = BABYLON.MeshBuilder.CreateGround(name + "_" + type + "_N", { width: width, height: nDepth }, this.scene);
                nPart.position.set(pos.x, yPos, pos.z + (hz + hd/2) + nDepth/2);
                parts.push(nPart);
            }
            const sDepth = (hz - hd/2) - (-depth/2);
            if (sDepth > 0.01) {
                const sPart = BABYLON.MeshBuilder.CreateGround(name + "_" + type + "_S", { width: width, height: sDepth }, this.scene);
                sPart.position.set(pos.x, yPos, pos.z + (-depth/2) + sDepth/2);
                parts.push(sPart);
            }
            const wWidth = (hx - hw/2) - (-width/2);
            if (wWidth > 0.01) {
                const wPart = BABYLON.MeshBuilder.CreateGround(name + "_" + type + "_W", { width: wWidth, height: hd }, this.scene);
                wPart.position.set(pos.x + (-width/2) + wWidth/2, yPos, pos.z + hz);
                parts.push(wPart);
            }
            const eWidth = (width/2) - (hx + hw/2);
            if (eWidth > 0.01) {
                const ePart = BABYLON.MeshBuilder.CreateGround(name + "_" + type + "_E", { width: eWidth, height: hd }, this.scene);
                ePart.position.set(pos.x + (hx + hw/2) + eWidth/2, yPos, pos.z + hz);
                parts.push(ePart);
            }
            parts.forEach(p => {
                if (type === "ceiling") p.rotation.x = Math.PI;
                p.material = materials[matName];
                p.checkCollisions = true;
                p.receiveShadows = true;
                if (this.shadowGenerator) this.shadowGenerator.addShadowCaster(p);
                p.parent = root;
            });
        };

        createSurfaceWithHole("floor", w + 1, d + 1, pos.y, options.floorMat || "floor_onyx", options.floorHole);
        if (!options.noCeiling) {
            createSurfaceWithHole("ceiling", w, d, pos.y + h, materials[options.ceilingMat] ? options.ceilingMat : "ceiling", options.ceilingHole);
        }
        
        const wallMat = materials[options.wallMat] || materials["asphalt_06_"];
        const createWall = (side, width, height, localPos, rotY) => {
            if (options.openSides && options.openSides.includes(side)) return
            const doors = options.doors ? options.doors.filter(d => d.side === side) : [];
            const wallRoot = new BABYLON.TransformNode("wall_" + side + "_root", this.scene);
            wallRoot.position = localPos.add(new BABYLON.Vector3(pos.x, pos.y, pos.z));
            wallRoot.rotation.y = rotY;
            wallRoot.parent = root;

            if (doors.length === 0) {
                const wall = BABYLON.MeshBuilder.CreateBox(name + "_wall_" + side, { width: width, height: height, depth: 1.0 }, this.scene);
                wall.position.set(0, height/2, 0);
                wall.material = wallMat;
                wall.checkCollisions = true;
                wall.receiveShadows = true;
                if (this.shadowGenerator) this.shadowGenerator.addShadowCaster(wall);
                wall.parent = wallRoot;
                return;
            }

            doors.sort((a, b) => (a.offset || 0) - (b.offset || 0));
            let currentX = -width / 2;
            const doorW = 8; const doorH = 7;
            doors.forEach((door, idx) => {
                const doorOffset = door.offset || 0;
                const doorLeft = doorOffset - doorW/2;
                const doorRight = doorOffset + doorW/2;
                const segWidth = doorLeft - currentX;
                if (segWidth > 0.01) {
                    const seg = BABYLON.MeshBuilder.CreateBox(name + "_wall_" + side + "_seg_" + idx, { width: segWidth, height: height, depth: 1.0 }, this.scene);
                    seg.position.set(currentX + segWidth/2, height/2, 0);
                    seg.material = wallMat; seg.checkCollisions = true; seg.receiveShadows = true;
                    if (this.shadowGenerator) this.shadowGenerator.addShadowCaster(seg);
                    seg.parent = wallRoot;
                }
                const headerH = height - doorH;
                if (headerH > 0.1) {
                    const head = BABYLON.MeshBuilder.CreateBox(name + "_wall_" + side + "_head_" + idx, { width: doorW, height: headerH, depth: 1.0 }, this.scene);
                    head.position.set(doorOffset, height - headerH/2, 0);
                    head.material = wallMat; head.checkCollisions = true; head.receiveShadows = true;
                    if (this.shadowGenerator) this.shadowGenerator.addShadowCaster(head);
                    head.parent = wallRoot;
                }
                currentX = doorRight;
            });
            const finalWidth = (width/2) - currentX;
            if (finalWidth > 0.01) {
                const seg = BABYLON.MeshBuilder.CreateBox(name + "_wall_" + side + "_final", { width: finalWidth, height: height, depth: 0.5 }, this.scene);
                seg.position.set(currentX + finalWidth/2, height/2, 0);
                seg.material = wallMat; seg.checkCollisions = true; seg.receiveShadows = true;
                if (this.shadowGenerator) this.shadowGenerator.addShadowCaster(seg);
                seg.parent = wallRoot;
            }
        };

        const halfW = w/2; const halfD = d/2;
        createWall('north', w, h, new BABYLON.Vector3(0, 0, halfD), 0);
        createWall('south', w, h, new BABYLON.Vector3(0, 0, -halfD), Math.PI);
        createWall('east', d, h, new BABYLON.Vector3(halfW, 0, 0), -Math.PI/2);
        createWall('west', d, h, new BABYLON.Vector3(-halfW, 0, 0), Math.PI/2);

        // Stairs Logic (simplified, assuming hardcoded stairs in DB for now or via special items)
        // For now, if room name is StairRoom or Basement, we inject stairs manually or check a property
        // But to keep it generic, we can check options.stairs
        if (options.stairs) {
             const { width, height, depth, steps, direction, offset = new BABYLON.Vector3(0,0,0) } = options.stairs;
             const stepHeight = height / steps;
             const stepDepth = depth / steps;
             const stairsRoot = new BABYLON.TransformNode(name + "_stairs", this.scene);
             stairsRoot.parent = root;
             stairsRoot.position = offset.add(new BABYLON.Vector3(pos.x, pos.y, pos.z));
             let rotY = 0;
             if (direction === 'east') rotY = -Math.PI/2;
             if (direction === 'west') rotY = Math.PI/2;
             if (direction === 'south') rotY = Math.PI;
             stairsRoot.rotation.y = rotY;
             for(let i=0; i<steps; i++) {
                 const step = BABYLON.MeshBuilder.CreateBox(name + "_step_" + i, {width: width, height: stepHeight, depth: stepDepth}, this.scene);
                 step.position.set(0, (i * stepHeight) + stepHeight/2, (i * stepDepth) + stepDepth/2);
                 step.material = materials["floor_wood"];
                 step.checkCollisions = true; step.receiveShadows = true;
                 if (this.shadowGenerator) this.shadowGenerator.addShadowCaster(step);
                 step.parent = stairsRoot;
             }
        }
        
        // Lighting from options
        if (options.lights) {
            options.lights.forEach((l, i) => {
                const pl = new BABYLON.PointLight(name + "_light_" + i, new BABYLON.Vector3(l.x, l.y, l.z).add(pos), this.scene);
                pl.intensity = l.intensity || 0.5;
                pl.radius = l.radius || 15;
                pl.parent = root;
            });
        }

        this.rooms.push({ name: name, pos: pos.clone(), size: { w, h, d }, bounds: bounds, root: root, neighbors: options.neighbors || [] });
        
        root.getChildMeshes().forEach((m) => {
            if (!m || m === root || !m.getBoundingInfo) return
            this.physics.registerMesh(m, CollisionLayers.STATIC, CollisionLayers.PLAYER | CollisionLayers.DYNAMIC, { isStatic: true })
        })
    };

    // --- CONVERT DB DATA TO LAYOUT ---
    const lobby = rooms.find((r) => r?.name === 'Lobby') || rooms[0]
    if (lobby) {
      const sx = Number(lobby.posX) || 0
      const sy = 0.9
      const sz = Number(lobby.posZ) || 0
      this.startPosition = new BABYLON.Vector3(sx, sy, sz)
    }

    rooms.forEach(room => {
        // Find connections for this room
        const myConns = connections.filter(c => c.fromRoomId === room.id);
        const doors = myConns.map(c => ({ side: c.direction, offset: 0 })); // Default offset 0 for now
        
        // Manual override for stairs (since DB schema for stairs is complex, we hardcode based on room name for demo)
        // ideally DB has a 'stairs' JSON field
        let stairs = null;
        let floorHole = null;
        let openSides = [];
        
        if (room.name === 'StairRoom') {
            stairs = { width: 12, height: 20, depth: 25, steps: 30, direction: 'east', offset: new BABYLON.Vector3(-5, 0, 0) };
            openSides = ['east'];
        } else if (room.name === 'Basement') {
            stairs = { width: 8, height: 12, depth: 18, steps: 20, direction: 'east', offset: new BABYLON.Vector3(0, 0, 0) };
        } else if (room.name === 'WestWing') {
            floorHole = { x: 0, z: 0, w: 10, d: 20 };
        } else if (room.name === 'UpperFloor') {
            openSides = ['west'];
        }

        // Neighbors names
        const neighborIds = myConns.map(c => c.toRoomId);
        const neighbors = rooms.filter(r => neighborIds.includes(r.id)).map(r => r.name);

        createRoom({
            name: room.name,
            pos: new BABYLON.Vector3(Number(room.posX) || 0, Number(room.posY) || 0, Number(room.posZ) || 0),
            size: { w: Number(room.width) || 10, h: Number(room.height) || 5, d: Number(room.depth) || 10 },
            options: {
                floorMat: room.floorMat,
                wallMat: room.wallMat,
                ceilingMat: room.ceilingMat,
                noCeiling: room.noCeiling,
                doors: doors,
                openSides: openSides,
                stairs: stairs,
                floorHole: floorHole,
                neighbors: neighbors,
                lights: [] // We could add a lights table later
            }
        });
    });

    // --- ITEMS ---
    const artworks = [];
    const registerArtwork = ({ mesh, title, description, triggerRadius = 3.0, cinematicRadius = 7.0 }) => {
      mesh.metadata = { ...(mesh.metadata || {}), isArtwork: true, title, description, triggerRadius, cinematicRadius }
      artworks.push(mesh)
    }

    if (Array.isArray(items)) {
        items.forEach(item => {
            // Create painting or item based on type
            // Assuming all seeded items are paintings for now (type 1)
            const width = 4 + (Number(item.scale) || 1); 
            const height = 3 + (Number(item.scale) || 1) * 0.5;
            
            // Frame
            const frameDepth = 0.15;
            const frame = BABYLON.MeshBuilder.CreateBox(`${item.name}_frame`, { width: width + 0.3, height: height + 0.3, depth: frameDepth }, this.scene);
            
            const posX = Number(item.posX) || 0;
            const posY = Number(item.posY) || 0;
            const posZ = Number(item.posZ) || 0;
            const rotY = Number(item.rotY) || 0;

            // Calculate absolute position based on room?
            // In DB we stored relative pos or absolute?
            // Seed.js stored absolute positions derived from World.js
            frame.position.set(posX, posY + (height/2 + 1.2), posZ);
            frame.rotation.y = rotY;
            
            const frameMat = new BABYLON.PBRMaterial(`${item.name}_frameMat`, this.scene);
            frameMat.albedoColor = BABYLON.Color3.FromHexString('#2a1b12');
            frameMat.roughness = 0.9;
            frame.material = frameMat;
            frame.checkCollisions = true;
            this.physics.registerMesh(frame, CollisionLayers.STATIC, CollisionLayers.PLAYER | CollisionLayers.DYNAMIC, { isStatic: true });

            const plane = BABYLON.MeshBuilder.CreatePlane(`${item.name}_painting`, { width, height }, this.scene);
            plane.position.copyFrom(frame.position);
            plane.position.z += Math.sin(rotY) * 0.09;
            plane.position.x += Math.cos(rotY) * 0.09;
            plane.rotation.y = rotY;
            
            const mat = new BABYLON.PBRMaterial(`${item.name}_mat`, this.scene);
            const tex = new BABYLON.Texture(item.file || "textures/misc.jpg", this.scene);
            mat.albedoTexture = tex;
            mat.roughness = 0.85;
            plane.material = mat;
            plane.isPickable = true;
            
            registerArtwork({ mesh: plane, title: item.name, description: item.description });

            // SpotLight for item
            const spot = new BABYLON.SpotLight(`${item.name}_spot`, plane.position.clone().add(new BABYLON.Vector3(0, 5.5, 0)), new BABYLON.Vector3(0, -1, 0), Math.PI / 3, 2, this.scene);
            spot.intensity = 1.3;
            spot.diffuse = new BABYLON.Color3(1, 0.97, 0.9);
        });
    }

    const lobbyRoom = this.rooms.find((r) => r?.name === 'Lobby')
    if (lobbyRoom?.root) {
      const imageFiles = [
        'I AM CLANCY TOP.png',
        'PALADIN WALLPAPER - HD @ivan_valido.png',
        'Paladin Strait - Placeholder @ivan_valido.png',
        'TOP WALLPAPER 01 - @ivan_valido.png',
        'TOP WALLPAPER 02 - @ivan_valido.png',
        'TOP WALLPAPER 03 - @ivan_valido.png',
        'VERTICAL VERSION POSTER NEW ERA - @ivan_valido.png',
        'WALLPAPER NEW ERA TOP - @ivan_valido.png',
        'WALLPAPER Overcompensate Teaser @ivan_valido.png',
        'cover - I am Clancy - @ivan_valido.png',
        'img-2.png',
        'wp15826836.jpg',
      ]

      const p = lobbyRoom.pos
      const halfW = lobbyRoom.size.w * 0.5
      const halfD = lobbyRoom.size.d * 0.5
      const wallInset = 0.55
      const ySlots = [2.45, 2.85, 2.6]
      const xSlots = [-24, 0, 24]
      const zSlots = [-24, 0, 24]

      const placements = []
      for (let i = 0; i < imageFiles.length; i++) {
        const wallIndex = i % 4
        const slot = Math.floor(i / 4) % 3
        if (wallIndex === 0) {
          placements.push({
            file: imageFiles[i],
            pos: new BABYLON.Vector3(p.x + xSlots[slot], p.y + ySlots[slot], p.z + halfD - wallInset),
            rotY: Math.PI,
          })
        } else if (wallIndex === 1) {
          placements.push({
            file: imageFiles[i],
            pos: new BABYLON.Vector3(p.x + xSlots[slot], p.y + ySlots[slot], p.z - halfD + wallInset),
            rotY: 0,
          })
        } else if (wallIndex === 2) {
          placements.push({
            file: imageFiles[i],
            pos: new BABYLON.Vector3(p.x + halfW - wallInset, p.y + ySlots[slot], p.z + zSlots[slot]),
            rotY: Math.PI / 2,
          })
        } else {
          placements.push({
            file: imageFiles[i],
            pos: new BABYLON.Vector3(p.x - halfW + wallInset, p.y + ySlots[slot], p.z + zSlots[slot]),
            rotY: -Math.PI / 2,
          })
        }
      }

      const ceilingY = p.y + lobbyRoom.size.h - 0.35
      const panelXs = [-24, 0, 24]
      const panelZs = [-24, 0, 24]
      for (let ix = 0; ix < panelXs.length; ix++) {
        for (let iz = 0; iz < panelZs.length; iz++) {
          const panel = BABYLON.MeshBuilder.CreateBox(`lobby_ceiling_panel_${ix}_${iz}`, { width: 10, height: 0.06, depth: 3.2 }, this.scene)
          panel.position.set(p.x + panelXs[ix], ceilingY, p.z + panelZs[iz])
          panel.parent = lobbyRoom.root
          panel.isPickable = false
          const pm = new BABYLON.PBRMaterial(`lobby_ceiling_panel_mat_${ix}_${iz}`, this.scene)
          pm.albedoColor = BABYLON.Color3.FromHexString('#0a0a0a')
          pm.emissiveColor = new BABYLON.Color3(1.0, 0.95, 0.88)
          pm.roughness = 0.9
          pm.metallic = 0.0
          panel.material = pm

          const spot = new BABYLON.SpotLight(`lobby_ceiling_spot_${ix}_${iz}`, panel.position.clone().add(new BABYLON.Vector3(0, -0.1, 0)), new BABYLON.Vector3(0, -1, 0), Math.PI / 2.2, 2, this.scene)
          spot.intensity = 0.75
          spot.diffuse = new BABYLON.Color3(1.0, 0.96, 0.9)
          spot.specular = new BABYLON.Color3(0.15, 0.15, 0.15)
          spot.parent = lobbyRoom.root
        }
      }

      const ledY = p.y + 0.08
      const ledInset = 0.9
      const ledMat = new BABYLON.PBRMaterial('lobby_led_mat', this.scene)
      ledMat.albedoColor = BABYLON.Color3.FromHexString('#05060a')
      ledMat.emissiveColor = new BABYLON.Color3(0.25, 0.65, 1.0)
      ledMat.roughness = 1.0
      ledMat.metallic = 0.0
      const ledNorth = BABYLON.MeshBuilder.CreateBox('lobby_led_north', { width: lobbyRoom.size.w - 6, height: 0.08, depth: 0.12 }, this.scene)
      ledNorth.position.set(p.x, ledY, p.z + halfD - ledInset)
      ledNorth.parent = lobbyRoom.root
      ledNorth.isPickable = false
      ledNorth.material = ledMat
      const ledSouth = BABYLON.MeshBuilder.CreateBox('lobby_led_south', { width: lobbyRoom.size.w - 6, height: 0.08, depth: 0.12 }, this.scene)
      ledSouth.position.set(p.x, ledY, p.z - halfD + ledInset)
      ledSouth.parent = lobbyRoom.root
      ledSouth.isPickable = false
      ledSouth.material = ledMat
      const ledEast = BABYLON.MeshBuilder.CreateBox('lobby_led_east', { width: 0.12, height: 0.08, depth: lobbyRoom.size.d - 6 }, this.scene)
      ledEast.position.set(p.x + halfW - ledInset, ledY, p.z)
      ledEast.parent = lobbyRoom.root
      ledEast.isPickable = false
      ledEast.material = ledMat
      const ledWest = BABYLON.MeshBuilder.CreateBox('lobby_led_west', { width: 0.12, height: 0.08, depth: lobbyRoom.size.d - 6 }, this.scene)
      ledWest.position.set(p.x - halfW + ledInset, ledY, p.z)
      ledWest.parent = lobbyRoom.root
      ledWest.isPickable = false
      ledWest.material = ledMat

      const createFramedImage = ({ file, pos, rotY }) => {
        const url = `textures/imagenes%20prueba/${encodeURIComponent(file)}`
        const plane = BABYLON.MeshBuilder.CreatePlane(`lobby_img_${file}`, { size: 1 }, this.scene)
        plane.position.copyFrom(pos)
        plane.rotation.y = rotY
        plane.isPickable = true
        plane.parent = lobbyRoom.root

        const frame = BABYLON.MeshBuilder.CreateBox(`lobby_frame_${file}`, { width: 1, height: 1, depth: 0.08 }, this.scene)
        frame.position.copyFrom(pos)
        frame.rotation.y = rotY
        frame.checkCollisions = true
        frame.parent = lobbyRoom.root
        this.physics.registerMesh(frame, CollisionLayers.STATIC, CollisionLayers.PLAYER | CollisionLayers.DYNAMIC, { isStatic: true })

        const mat = new BABYLON.PBRMaterial(`lobby_img_mat_${file}`, this.scene)
        const tex = new BABYLON.Texture(url, this.scene, true, false)
        mat.albedoTexture = tex
        mat.emissiveTexture = tex
        mat.emissiveColor = new BABYLON.Color3(1, 1, 1)
        mat.roughness = 0.92
        mat.metallic = 0.02
        mat.backFaceCulling = false
        plane.material = mat

        const frameMat = new BABYLON.PBRMaterial(`lobby_frame_mat_${file}`, this.scene)
        frameMat.albedoColor = BABYLON.Color3.FromHexString('#1a1410')
        frameMat.roughness = 0.85
        frameMat.metallic = 0.25
        frame.material = frameMat

        const nx = Math.sin(rotY)
        const nz = Math.cos(rotY)
        frame.position.x += nx * 0.03
        frame.position.z += nz * 0.03
        plane.position.x += nx * 0.09
        plane.position.z += nz * 0.09

        const applySize = () => {
          const s = tex.getSize()
          const w = Number(s?.width) || 1024
          const h = Number(s?.height) || 1024
          const meterPerPixel = 0.0012
          let mw = w * meterPerPixel
          let mh = h * meterPerPixel
          const maxW = 7.5
          const maxH = 3.4
          const k = Math.min(maxW / mw, maxH / mh, 1)
          mw *= k
          mh *= k
          plane.scaling.x = mw
          plane.scaling.y = mh
          frame.scaling.x = mw + 0.18
          frame.scaling.y = mh + 0.18

          const lightPos = plane.position.clone()
          lightPos.y += 2.1
          lightPos.x -= nx * 1.1
          lightPos.z -= nz * 1.1
          const dir = plane.position.subtract(lightPos)
          if (dir.lengthSquared() > 0.0001) dir.normalize()
          const spot = new BABYLON.SpotLight(`lobby_img_spot_${file}`, lightPos, dir, Math.PI / 3.2, 2, this.scene)
          spot.intensity = 1.65
          spot.diffuse = new BABYLON.Color3(1, 0.97, 0.92)
          spot.specular = new BABYLON.Color3(0.35, 0.35, 0.35)
          spot.parent = lobbyRoom.root
        }

        if (tex.onLoadObservable) {
          tex.onLoadObservable.addOnce(() => applySize())
        } else {
          setTimeout(() => applySize(), 0)
        }

        registerArtwork({
          mesh: plane,
          title: file,
          description: '',
          triggerRadius: 3.2,
          cinematicRadius: 7.5,
        })
      }

      placements.forEach((pl) => createFramedImage(pl))
    }

    // Check for overlaps
    const roomAabbs = this.rooms.map((r) => buildRoomAABB({ name: r.name, pos: r.pos, size: r.size }))
    const overlaps = this.physics.validateNoOverlaps(roomAabbs, 0.0001)
    if (overlaps.length) {
      console.warn('Overlaps detectados: ' + overlaps.map((p) => p.join(' <-> ')).join(', '))
    }

    // Register interactions loop
    this.scene.registerBeforeRender(() => {
        if(this.player && this.player.mesh) {
            this.physics.applyBroadphaseToBabylonCollisions(this.player.mesh.position)
            this.nearArtwork = this.findNearestArtwork(artworks)
        }
        this.checkInteraction();
    });

    // Create Particle Exhibitors in Lobby
    this.createParticleExhibitors();
  }

  createParticleExhibitors() {
      const lobbyRoom = this.rooms.find((r) => r?.name === 'Lobby')
      const center = lobbyRoom?.pos ? lobbyRoom.pos.clone() : new BABYLON.Vector3(0, 0, 0);
      const radius = lobbyRoom?.size ? Math.max(6, Math.min(lobbyRoom.size.w, lobbyRoom.size.d) * 0.22) : 6;
      const count = 10;
      
      for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          const x = center.x + Math.cos(angle) * radius;
          const z = center.z + Math.sin(angle) * radius;
          
          // Exhibitor Base
          const box = BABYLON.MeshBuilder.CreateBox("exhibitor_" + i, { width: 1, height: 1, depth: 1 }, this.scene);
          box.position.set(x, 0.5, z);
          const mat = new BABYLON.PBRMaterial("exhibitor_mat_" + i, this.scene);
          mat.albedoColor = new BABYLON.Color3(0.1, 0.1, 0.1);
          mat.metallic = 0.8;
          mat.roughness = 0.2;
          box.material = mat;
          box.checkCollisions = true;
          this.physics.registerMesh(box, CollisionLayers.STATIC, CollisionLayers.PLAYER | CollisionLayers.DYNAMIC, { isStatic: true });
          
          // Create Effect based on index
          this.createParticleSystem(i, box.position.clone().add(new BABYLON.Vector3(0, 0.6, 0)));
      }
  }

  createParticleSystem(index, position) {
      const ps = new BABYLON.ParticleSystem("ps_" + index, 2000, this.scene);
      ps.particleTexture = new BABYLON.Texture("textures/flare.png", this.scene);
      ps.emitter = position;
      
      switch(index) {
          case 0: // Fire
              ps.minEmitBox = new BABYLON.Vector3(-0.1, 0, -0.1);
              ps.maxEmitBox = new BABYLON.Vector3(0.1, 0.1, 0.1);
              ps.color1 = new BABYLON.Color4(1, 0.5, 0, 1);
              ps.color2 = new BABYLON.Color4(1, 0.2, 0, 1);
              ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);
              ps.minSize = 0.1; ps.maxSize = 0.5;
              ps.minLifeTime = 0.3; ps.maxLifeTime = 1.5;
              ps.emitRate = 500;
              ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
              ps.gravity = new BABYLON.Vector3(0, 3, 0); // Rising
              ps.direction1 = new BABYLON.Vector3(-0.5, 1, -0.5);
              ps.direction2 = new BABYLON.Vector3(0.5, 1, 0.5);
              ps.minAngularSpeed = 0; ps.maxAngularSpeed = Math.PI;
              break;
              
          case 1: // Blue Magic Spiral
              ps.minEmitBox = new BABYLON.Vector3(0, 0, 0);
              ps.maxEmitBox = new BABYLON.Vector3(0, 0, 0);
              ps.color1 = new BABYLON.Color4(0, 0.5, 1, 1);
              ps.color2 = new BABYLON.Color4(0.2, 0.8, 1, 1);
              ps.minSize = 0.05; ps.maxSize = 0.2;
              ps.minLifeTime = 1.0; ps.maxLifeTime = 2.0;
              ps.emitRate = 200;
              ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
              ps.gravity = new BABYLON.Vector3(0, 0.5, 0);
              
              // Custom update for spiral
              let time = 0;
              ps.startDirectionFunction = (emitPower, worldMatrix, directionToUpdate, particle, isLocal) => {
                  time += 0.1;
                  let dx = Math.cos(time);
                  let dy = 2;
                  let dz = Math.sin(time);
                  
                  // Normalize manually
                  const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
                  if (len > 0) {
                      dx /= len; dy /= len; dz /= len;
                  }
                  
                  // Scale manually
                  directionToUpdate.x = dx * emitPower;
                  directionToUpdate.y = dy * emitPower;
                  directionToUpdate.z = dz * emitPower;
              };
              break;

          case 2: // Green Toxic Smoke
              ps.particleTexture = new BABYLON.Texture("textures/sparkStretched.png", this.scene); // Different texture if avail
              ps.minEmitBox = new BABYLON.Vector3(-0.2, 0, -0.2);
              ps.maxEmitBox = new BABYLON.Vector3(0.2, 0, 0.2);
              ps.color1 = new BABYLON.Color4(0.2, 1, 0.2, 0.5);
              ps.color2 = new BABYLON.Color4(0, 0.5, 0, 0.2);
              ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);
              ps.minSize = 0.5; ps.maxSize = 1.5;
              ps.minLifeTime = 1.0; ps.maxLifeTime = 2.5;
              ps.emitRate = 100;
              ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
              ps.gravity = new BABYLON.Vector3(0, 0.5, 0);
              break;
              
          case 3: // Rain Fountain
              ps.minEmitBox = new BABYLON.Vector3(0, 2, 0); // Start high
              ps.maxEmitBox = new BABYLON.Vector3(0, 2, 0);
              ps.color1 = new BABYLON.Color4(0.8, 0.8, 1, 1);
              ps.color2 = new BABYLON.Color4(0.5, 0.5, 1, 1);
              ps.minSize = 0.05; ps.maxSize = 0.1;
              ps.minLifeTime = 1.0; ps.maxLifeTime = 1.0;
              ps.emitRate = 300;
              ps.gravity = new BABYLON.Vector3(0, -9.8, 0); // Falling
              ps.direction1 = new BABYLON.Vector3(-1, 0, -1);
              ps.direction2 = new BABYLON.Vector3(1, 0, 1);
              ps.minEmitPower = 0; ps.maxEmitPower = 2;
              break;

          case 4: // Galaxy / Star field
              ps.minEmitBox = new BABYLON.Vector3(-1, -1, -1);
              ps.maxEmitBox = new BABYLON.Vector3(1, 1, 1);
              ps.color1 = new BABYLON.Color4(1, 1, 1, 1);
              ps.color2 = new BABYLON.Color4(1, 0.8, 0.8, 1);
              ps.minSize = 0.02; ps.maxSize = 0.08;
              ps.minLifeTime = 2.0; ps.maxLifeTime = 5.0;
              ps.emitRate = 50;
              ps.gravity = new BABYLON.Vector3(0, 0, 0); // Floating
              ps.minEmitPower = 0; ps.maxEmitPower = 0.1;
              break;

          case 5: // Electric Orb
              ps.particleTexture = new BABYLON.Texture("textures/flare.png", this.scene);
              ps.minEmitBox = new BABYLON.Vector3(0, 0, 0);
              ps.maxEmitBox = new BABYLON.Vector3(0, 0, 0);
              ps.color1 = new BABYLON.Color4(0.8, 0, 1, 1);
              ps.color2 = new BABYLON.Color4(1, 1, 1, 1);
              ps.minSize = 0.1; ps.maxSize = 0.3;
              ps.minLifeTime = 0.1; ps.maxLifeTime = 0.2;
              ps.emitRate = 1000;
              ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
              ps.minEmitPower = 1; ps.maxEmitPower = 3;
              ps.direction1 = new BABYLON.Vector3(-1, -1, -1);
              ps.direction2 = new BABYLON.Vector3(1, 1, 1);
              break;

          case 6: // Snow
              ps.minEmitBox = new BABYLON.Vector3(-0.5, 2, -0.5);
              ps.maxEmitBox = new BABYLON.Vector3(0.5, 2, 0.5);
              ps.color1 = new BABYLON.Color4(1, 1, 1, 1);
              ps.color2 = new BABYLON.Color4(0.9, 0.9, 1, 1);
              ps.minSize = 0.05; ps.maxSize = 0.1;
              ps.minLifeTime = 2.0; ps.maxLifeTime = 3.0;
              ps.emitRate = 100;
              ps.gravity = new BABYLON.Vector3(0, -0.5, 0); // Slow fall
              ps.direction1 = new BABYLON.Vector3(-0.5, -1, -0.5);
              ps.direction2 = new BABYLON.Vector3(0.5, -1, 0.5);
              break;
              
          case 7: // Red Explosion Loop
              ps.minEmitBox = new BABYLON.Vector3(0, 0, 0);
              ps.maxEmitBox = new BABYLON.Vector3(0, 0, 0);
              ps.color1 = new BABYLON.Color4(1, 0, 0, 1);
              ps.color2 = new BABYLON.Color4(1, 1, 0, 1);
              ps.colorDead = new BABYLON.Color4(0.2, 0, 0, 0);
              ps.minSize = 0.2; ps.maxSize = 0.8;
              ps.minLifeTime = 0.5; ps.maxLifeTime = 0.8;
              ps.emitRate = 50; // Burst-like
              ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
              ps.minEmitPower = 1; ps.maxEmitPower = 4;
              ps.direction1 = new BABYLON.Vector3(-1, 1, -1);
              ps.direction2 = new BABYLON.Vector3(1, 1, 1);
              break;
              
          case 8: // Heart/Love (Pink Float)
              ps.minEmitBox = new BABYLON.Vector3(-0.3, 0, -0.3);
              ps.maxEmitBox = new BABYLON.Vector3(0.3, 0, 0.3);
              ps.color1 = new BABYLON.Color4(1, 0.4, 0.7, 1);
              ps.color2 = new BABYLON.Color4(1, 0.8, 0.9, 1);
              ps.minSize = 0.1; ps.maxSize = 0.2;
              ps.minLifeTime = 1.5; ps.maxLifeTime = 2.5;
              ps.emitRate = 60;
              ps.gravity = new BABYLON.Vector3(0, 0.2, 0); // Floating up
              break;
              
          case 9: // Matrix / Code Rain (Green vertical)
              ps.minEmitBox = new BABYLON.Vector3(-0.5, 2, 0);
              ps.maxEmitBox = new BABYLON.Vector3(0.5, 2, 0);
              ps.color1 = new BABYLON.Color4(0, 1, 0, 1);
              ps.color2 = new BABYLON.Color4(0, 0.5, 0, 1);
              ps.minSize = 0.1; ps.maxSize = 0.15;
              ps.minLifeTime = 1.5; ps.maxLifeTime = 2.0;
              ps.emitRate = 150;
              ps.gravity = new BABYLON.Vector3(0, -2, 0);
              break;
      }
      
      ps.start();
  }

  findNearestArtwork(artworks) {
    if (!this.player?.mesh) return null
    if (this.cinematic.active) return null
    const p = this.player.mesh.position
    let best = null
    let bestDist = Infinity
    for (const a of artworks) {
      if (!a?.metadata?.isArtwork) continue
      const r = typeof a.metadata.triggerRadius === 'number' ? a.metadata.triggerRadius : 3
      const d = BABYLON.Vector3.Distance(p, a.position)
      if (d <= r && d < bestDist) {
        best = a
        bestDist = d
      }
    }
    return best
  }

  checkInteraction() {
      if (!this.camera || !this.scene) return;
      
      const prompt = document.getElementById('interaction-prompt');
      if (!prompt) return;

      if (this.nearArtwork) {
          prompt.style.display = 'block';
      } else {
          prompt.style.display = 'none';
      }
  }

  // Handle Interaction Trigger (Called from Controls)
  triggerInteraction() {
      if (this.cinematic.active) {
        if (!this.cinematic.exiting) this.exitCinematic()
        return
      }
      if (!this.nearArtwork) return
      this.enterCinematic(this.nearArtwork)
  }

  enterCinematic(artMesh) {
    if (!this.player?.mesh || !this.camera) return
    const meta = artMesh.metadata || {}
    this.cinematic.active = true
    this.cinematic.exiting = false
    this.activeArtwork = artMesh
    this.cinematic.saved = {
      alpha: this.camera.alpha,
      beta: this.camera.beta,
      radius: this.camera.radius,
      target: this.camera.target.clone(),
      playerPos: this.player.mesh.position.clone(),
      playerRotY: this.player.mesh.rotation.y,
    }

    const p0 = this.player.mesh.position.clone()
    const a0 = artMesh.position.clone()
    const dirToArt = a0.subtract(p0)
    dirToArt.y = 0
    if (dirToArt.lengthSquared() < 0.0001) dirToArt.z = 1
    dirToArt.normalize()

    const desiredPlayer = a0.subtract(dirToArt.scale(3.0))
    desiredPlayer.y = p0.y
    
    // Player Position
    this.player.mesh.position.copyFrom(desiredPlayer)
    
    // Player Rotation (Shortest Path)
    const desiredRot = Math.atan2(dirToArt.x, dirToArt.z)
    const currentRot = this.cinematic.saved.playerRotY
    let rotDiff = desiredRot - currentRot
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
    this.player.mesh.rotation.y = currentRot + rotDiff

    const p = this.player.mesh.position.clone()
    const a = artMesh.position.clone()

    const mid = BABYLON.Vector3.Lerp(p, a, 0.52)
    mid.y = Math.max(p.y + 1.3, a.y + 1.5)

    const side = BABYLON.Vector3.Cross(BABYLON.Axis.Y, dirToArt).normalize()
    const camPos = mid.add(side.scale(3.2)).subtract(dirToArt.scale(8.2)).add(new BABYLON.Vector3(0, 2.2, 0))

    const v = camPos.subtract(mid)
    const r = v.length()
    const beta = Math.acos(v.y / r)
    const alpha = Math.atan2(v.z, v.x)

    // Camera Alpha (Shortest Path)
    const currentAlpha = this.camera.alpha
    let alphaDiff = alpha - currentAlpha
    while (alphaDiff < -Math.PI) alphaDiff += Math.PI * 2
    while (alphaDiff > Math.PI) alphaDiff -= Math.PI * 2
    
    this.cinematic.targetAlpha = currentAlpha + alphaDiff
    this.cinematic.targetBeta = beta
    this.cinematic.targetRadius = r
    this.cinematic.targetTarget = mid

    const modal = document.getElementById('art-subtitles')
    const title = document.getElementById('art-title')
    const desc = document.getElementById('art-desc')
    if (modal && title && desc) {
      title.innerText = meta.title || 'Obra'
      desc.innerText = meta.description || ''
      modal.classList.remove('hidden')
    }
  }

  exitCinematic() {
    if (!this.cinematic.saved || !this.player?.mesh || !this.camera) {
      this.cinematic.active = false
      return
    }
    const s = this.cinematic.saved
    
    // Set targets to saved values for smooth exit
    this.cinematic.targetAlpha = s.alpha
    this.cinematic.targetBeta = s.beta
    this.cinematic.targetRadius = s.radius
    this.cinematic.targetTarget = s.target
    
    this.cinematic.exiting = true

    const modal = document.getElementById('art-subtitles')
    if (modal) modal.classList.add('hidden')
  }

  updateCinematicCamera() {
    if (!this.camera) return
    if (!this.cinematic.active) return
    if (!this.cinematic.targetTarget) return
    
    // Smooth Camera Transition
    this.camera.target = BABYLON.Vector3.Lerp(this.camera.target, this.cinematic.targetTarget, 0.08)
    this.camera.alpha = BABYLON.Scalar.Lerp(this.camera.alpha, this.cinematic.targetAlpha, 0.08)
    this.camera.beta = BABYLON.Scalar.Lerp(this.camera.beta, this.cinematic.targetBeta, 0.08)
    this.camera.radius = BABYLON.Scalar.Lerp(this.camera.radius, this.cinematic.targetRadius, 0.08)

    // Handle Exiting State
    if (this.cinematic.exiting && this.cinematic.saved) {
        const s = this.cinematic.saved
        
        // Smooth Player Transition (Back to original spot)
        this.player.mesh.position = BABYLON.Vector3.Lerp(this.player.mesh.position, s.playerPos, 0.08)
        this.player.mesh.rotation.y = BABYLON.Scalar.Lerp(this.player.mesh.rotation.y, s.playerRotY, 0.08)
        
        // Check Completion
        const dist = BABYLON.Vector3.Distance(this.camera.target, this.cinematic.targetTarget)
        const pDist = BABYLON.Vector3.Distance(this.player.mesh.position, s.playerPos)
        
        if (dist < 0.2 && pDist < 0.2) {
            // Restore exact values and finish
            this.camera.target.copyFrom(s.target)
            this.camera.alpha = s.alpha
            this.camera.beta = s.beta
            this.camera.radius = s.radius
            this.player.mesh.position.copyFrom(s.playerPos)
            this.player.mesh.rotation.y = s.playerRotY
            
            this.cinematic.active = false
            this.cinematic.exiting = false
            this.activeArtwork = null
            this.cinematic.saved = null
        }
    } else {
        const desiredPos = this._arcRotateDesiredPosition(this.camera.target, this.camera.alpha, this.camera.beta, this.camera.radius)
        const resolved = resolveCameraObstruction({
          scene: this.scene,
          camera: this.camera,
          target: this.camera.target,
          desiredPosition: desiredPos,
          collisionMaskPredicate: (m) => m && m.checkCollisions && m !== this.player?.mesh,
        })
        const safeRadius = BABYLON.Vector3.Distance(this.camera.target, resolved)
        if (Number.isFinite(safeRadius)) this.camera.radius = BABYLON.Scalar.Lerp(this.camera.radius, Math.max(0.25, safeRadius), 0.35)
    }
  }

  _arcRotateDesiredPosition(target, alpha, beta, radius) {
    const a = Number(alpha) || 0
    const b = BABYLON.Scalar.Clamp(Number(beta) || Math.PI / 2, 0.25, Math.PI - 0.25)
    const r = Math.max(0.25, Number(radius) || 0.25)
    const sinB = Math.sin(b)
    const x = target.x + r * Math.cos(a) * sinB
    const y = target.y + r * Math.cos(b)
    const z = target.z + r * Math.sin(a) * sinB
    return new BABYLON.Vector3(x, y, z)
  }

  applySettings(settings) {
    this.settings = settings
    if (this.scene?.imageProcessingConfiguration && settings?.brightness != null) {
      this.scene.imageProcessingConfiguration.exposure = settings.brightness
    }
    if (this.pipeline?.imageProcessing && settings?.brightness != null) {
      this.pipeline.imageProcessing.exposure = settings.brightness
    }

    const audios = this.assetManager?.audios
    if (audios && typeof audios.forEach === 'function') {
      audios.forEach((sound, key) => {
        if (!sound) return
        if (!sound.metadata) sound.metadata = {}
        if (typeof sound.metadata.baseVolume !== 'number' && typeof sound.getVolume === 'function') {
          sound.metadata.baseVolume = sound.getVolume()
        }
        const base = typeof sound.metadata.baseVolume === 'number' ? sound.metadata.baseVolume : 1
        const master = typeof settings?.masterVolume === 'number' ? settings.masterVolume : 1
        const sfx = typeof settings?.sfxVolume === 'number' ? settings.sfxVolume : 1
        const music = typeof settings?.musicVolume === 'number' ? settings.musicVolume : 1
        const mix = key === 'ambience' ? master * music : master * sfx
        if (typeof sound.setVolume === 'function') sound.setVolume(base * mix)
      })
    }
  }

  // Check which room the player is in and toggle visibility
  updateActiveRooms() {
    if (!this.player || !this.player.mesh) return;
    
    const pos = this.player.mesh.position;
    
    // Find room containing player
    let activeRoom = null;
    for (const room of this.rooms) {
        const min = room.bounds.min;
        const max = room.bounds.max;
        
        // Simple AABB check with margin
        if (pos.x >= min.x - 1 && pos.x <= max.x + 1 &&
            pos.z >= min.z - 1 && pos.z <= max.z + 1 &&
            pos.y >= min.y - 1 && pos.y <= max.y + 1) { 
            activeRoom = room;
            break;
        }
    }
    
    if (activeRoom) this.currentRoom = activeRoom;
    if (!activeRoom) {
      let best = null
      let bestDist = Infinity
      for (const room of this.rooms) {
        const min = room.bounds.min
        const max = room.bounds.max
        const cx = (min.x + max.x) * 0.5
        const cz = (min.z + max.z) * 0.5
        const dx = cx - pos.x
        const dz = cz - pos.z
        const d = Math.hypot(dx, dz)
        if (d < bestDist) {
          best = room
          bestDist = d
        }
      }
      if (best) this.currentRoom = best
    }

    if (!this.camera) return

    const forward3 = this.camera.getForwardRay(1).direction
    const forward = new BABYLON.Vector3(forward3.x, 0, forward3.z)
    if (forward.lengthSquared() > 0.0001) forward.normalize()
    const angleLimit = (this.camera.fov || 0.9) * 0.6 + 0.35
    const cosLimit = Math.cos(angleLimit)
    const maxDist = 140

    const visibleNames = new Set()
    if (this.currentRoom) visibleNames.add(this.currentRoom.name)
    if (this.currentRoom?.neighbors) {
      for (const n of this.currentRoom.neighbors) visibleNames.add(n)
    }

    for (const room of this.rooms) {
      const min = room.bounds.min
      const max = room.bounds.max
      const center = new BABYLON.Vector3((min.x + max.x) * 0.5, (min.y + max.y) * 0.5, (min.z + max.z) * 0.5)
      const to = center.subtract(pos)
      const planar = new BABYLON.Vector3(to.x, 0, to.z)
      const dist = planar.length()
      if (dist > maxDist) continue
      if (dist < 0.001) {
        visibleNames.add(room.name)
        continue
      }
      planar.scaleInPlace(1 / dist)
      const dot = BABYLON.Vector3.Dot(planar, forward)
      if (dot >= cosLimit) {
        visibleNames.add(room.name)
      } else if (this.currentRoom && this.currentRoom.neighbors && this.currentRoom.neighbors.includes(room.name) && dist < 35) {
        visibleNames.add(room.name)
      }
    }

    this.rooms.forEach((r) => {
      const shouldEnable = visibleNames.has(r.name)
      if (r._enabled === shouldEnable) return
      r._enabled = shouldEnable
      r.root.setEnabled(shouldEnable)
    })
  }

  toggleCameraMode() {
    this.cameraMode = this.cameraMode === 'THIRD_PERSON' ? 'FIRST_PERSON' : 'THIRD_PERSON';
  }

  animate() {
    this.frameCount++;

    // Physics Broadphase (Throttle: every 4 frames)
    if (this.player?.mesh && this.physics && (this.frameCount % 4 === 0)) {
      this.physics.applyBroadphaseToBabylonCollisions(this.player.mesh.position)
    }
    if (this.controls) this.controls.update();
    
    // Room Visibility (Throttle: every 5 frames)
    if (this.frameCount % 5 === 0) {
        this.updateActiveRooms();
    }

    if (this.player && this.player.mesh && this.camera) {
      const playerMesh = this.player.mesh;
      if (this.cinematic.active) {
        this.updateCinematicCamera()
      } else {
        // Standard Camera Logic
        const targetPos = playerMesh.position.clone();
        targetPos.y += 1.6; // Head height
        
        // Input from Controls
        const lookPitch = this.controls.lookPitch || 0;
        
        // Calculate desired camera position based on rotation
        const rotation = playerMesh.rotation.y;
        
        // In FIRST_PERSON, we want the camera to follow the player's rotation exactly, 
        // regardless of movement direction.
        // In THIRD_PERSON, standard behavior (already handled below).
        
        let targetAlpha = -rotation - Math.PI/2;
        
        // Smoothly update target to avoid jitter, but fast enough to prevent lag
        this.camera.target = BABYLON.Vector3.Lerp(this.camera.target, targetPos, 0.4);

        // Alpha Rotation with Shortest Path interpolation (avoids spinning loops)
        let currentAlpha = this.camera.alpha;
        let alphaDiff = targetAlpha - currentAlpha;
        while (alphaDiff < -Math.PI) alphaDiff += Math.PI * 2;
        while (alphaDiff > Math.PI) alphaDiff -= Math.PI * 2;
        this.camera.alpha = currentAlpha + alphaDiff * 0.1;
        
        if (this.cameraMode === 'FIRST_PERSON') {
            const targetBeta = (Math.PI / 2) + lookPitch;
            
            // FORCE UPDATE: No Lerp in First Person to prevent camera flip/lag
            this.camera.target.copyFrom(targetPos); 
            this.camera.radius = 0.1;
            this.camera.beta = targetBeta;
            this.camera.alpha = -rotation - Math.PI/2;
            
            this.camera.checkCollisions = false; // Disable cam collision in FP
            
            // Hide player mesh in FP
            if (this.player.mesh.isVisible) this.player.mesh.isVisible = false;
            // Also hide children if any (like accessories) - assuming simple mesh for now
            this.player.mesh.getChildMeshes().forEach(m => m.isVisible = false);

        } else {
            // Show player mesh in TP
            if (!this.player.mesh.isVisible) this.player.mesh.isVisible = true;
            this.player.mesh.getChildMeshes().forEach(m => m.isVisible = true);

            const desiredBeta = 1.45 + lookPitch;
            this.camera.beta = BABYLON.Scalar.Lerp(this.camera.beta, desiredBeta, 0.1);
            this.camera.checkCollisions = true;
            
            // Collision Resolution (Only for TP)
            const desiredRadius = 4.5
            const desiredPos = this._arcRotateDesiredPosition(this.camera.target, this.camera.alpha, this.camera.beta, desiredRadius)
            const hitResolved = resolveCameraObstruction({
              scene: this.scene,
              camera: this.camera,
              target: this.camera.target,
              desiredPosition: desiredPos,
              collisionMaskPredicate: (m) => m && m.checkCollisions && m !== this.player?.mesh,
            })
            const safeRadius = BABYLON.Vector3.Distance(this.camera.target, hitResolved)
            const allowedRadius = Number.isFinite(safeRadius) ? Math.max(0.5, Math.min(desiredRadius, safeRadius)) : desiredRadius
            
            // Apply radius with hysteresis to prevent oscillation
            if (Math.abs(this.camera.radius - allowedRadius) > 0.05) {
                this.camera.radius = BABYLON.Scalar.Lerp(this.camera.radius, allowedRadius, 0.2);
            } else {
                this.camera.radius = allowedRadius;
            }
        }
      }
    }
    this.scene.render();
  }

  onWindowResize() {
    if (this.engine) this.engine.resize();
  }
}

export default new World();
