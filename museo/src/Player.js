/**
 * Player class - Manages the character mesh and movement state
 */
export class Player {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    
    // Movement state
    this.velocity = new BABYLON.Vector3(0, 0, 0);
    this.rotation = new BABYLON.Vector3(0, 0, 0);
    
    // Settings
    this.moveSpeed = 0.15; // Velocidad de avance
    this.rotSpeed = 0.03;  // Velocidad de giro
    
    this.init();
  }

  init() {
    // Create the visual representation (Capsule)
    // Usamos CreateCapsule de MeshBuilder
    const mesh = BABYLON.MeshBuilder.CreateCapsule("player", { radius: 0.4, height: 1.8, subdivisions: 4 }, this.scene);
    mesh.position.y = 2.0; // Start a bit higher to avoid sticking
    mesh.checkCollisions = true; // Activar colisiones nativas de Babylon
    mesh.applyGravity = false; // We handle gravity manually in Controls
    mesh.ellipsoid = new BABYLON.Vector3(0.4, 0.9, 0.4); // Colisionador elipsoide para el sistema de cámara/física simple
    mesh.ellipsoidOffset = new BABYLON.Vector3(0, 0, 0); // Offset 0 porque el pivote ya está en el centro (0.9)
    
    // Material
    const mat = new BABYLON.PBRMaterial("playerMat", this.scene);
    mat.albedoColor = BABYLON.Color3.FromHexString("#ffcc00");
    mat.metallic = 0.6;
    mat.roughness = 0.4;
    mesh.material = mat;
    
    // Indicator (to see facing direction)
    const indicator = BABYLON.MeshBuilder.CreateBox("indicator", { width: 0.2, height: 0.2, depth: 0.5 }, this.scene);
    indicator.parent = mesh;
    indicator.position.z = 0.5;
    indicator.position.y = 0.5;
    const indMat = new BABYLON.StandardMaterial("indMat", this.scene);
    indMat.emissiveColor = BABYLON.Color3.White();
    indicator.material = indMat;

    this.mesh = mesh;
  }
}
