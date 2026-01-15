/**
 * Controls for the Player (Tank Style + Camera Toggle)
 */
export class FirstPersonControls {
  constructor(player, world) {
    this.player = player;
    this.world = world; // Access to world for camera switching
    
    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      lookUp: false,
      lookDown: false
    };
    
    // Physics State
    this.gravity = -0.5; // Gravity force
    this.fallSpeed = 0;
    this.isGrounded = false;
    this.gravityScale = 1.0
    this.stepTimer = 0
    this.stepAlt = false

    // Smooth Movement Settings
    this.currentVelocity = new BABYLON.Vector3(0, 0, 0);
    this.currentRotSpeed = 0; // Current rotation speed for smoothing
    this.movementConfig = {
        acceleration: 8.0, // Higher = Faster start (0.3-0.5s approx)
        deceleration: 3.0, // Lower = Longer slide (0.5-1s approx)
        rotationSmooth: 5.0 // Controls rotation inertia (Higher = Snappier)
    };
    
    // Camera Interaction
    this.lookPitch = 0; // Vertical look offset
    
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }

  connect() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  disconnect() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  onKeyDown(e) {
    switch(e.key.toLowerCase()) {
      case 'w': this.input.forward = true; break;
      case 's': this.input.backward = true; break;
      case 'a': this.input.left = true; break;
      case 'd': this.input.right = true; break;
      case 'shift': this.input.sprint = true; break;
      case 'arrowleft': this.world.toggleCameraMode(); break;
      case 'arrowright': this.world.triggerInteraction(); break;
      case 'arrowdown': this.input.lookUp = true; break;
      case 'arrowup': this.input.lookDown = true; break;
    }
  }

  onKeyUp(e) {
    switch(e.key.toLowerCase()) {
      case 'w': this.input.forward = false; break;
      case 's': this.input.backward = false; break;
      case 'a': this.input.left = false; break;
      case 'd': this.input.right = false; break;
      case 'shift': this.input.sprint = false; break;
      case 'arrowdown': this.input.lookUp = false; break;
      case 'arrowup': this.input.lookDown = false; break;
    }
  }

  update(delta) {
    if (!this.player || !this.player.mesh) return;
    if (this.world?.cinematic?.active) return;

    const mesh = this.player.mesh;
    const dt = this.world.engine.getDeltaTime() / 1000.0;
    
    // Look Logic (Smoothly interpolate pitch)
    const targetPitch = this.input.lookUp ? -0.4 : (this.input.lookDown ? 0.4 : 0);
    this.lookPitch = BABYLON.Scalar.Lerp(this.lookPitch, targetPitch, 5 * dt);

    const ratio = this.world.scene.getAnimationRatio();
    // Base speeds
    const targetSpeed = (this.input.sprint ? this.player.moveSpeed * 1.8 : this.player.moveSpeed) * ratio;
    const rotSpeed = this.player.rotSpeed * ratio;

    // Determine direction inversion based on camera mode and movement
    let invertTurn = 1;
    // In THIRD_PERSON and FIRST_PERSON, if moving backward, invert A/D
    // The user requested: "En tercera persona cuando el personaje este retrocediendo con la tecla S, invierte las direcciones"
    // And also for FIRST_PERSON to work exactly the same.
    if (this.input.backward && !this.input.forward) {
        invertTurn = -1;
    }

    // Smooth Rotation
    let targetRotInput = 0;
    if (this.input.left) targetRotInput -= 1;
    if (this.input.right) targetRotInput += 1;
    
    // Apply inversion
    targetRotInput *= invertTurn;

    // Interpolate rotation speed
    // This gives "ease-in" when starting to turn, and "ease-out" (inertia) when stopping
    this.currentRotSpeed = BABYLON.Scalar.Lerp(this.currentRotSpeed, targetRotInput * rotSpeed, this.movementConfig.rotationSmooth * dt);
    
    // Apply smoothed rotation
    mesh.rotation.y += this.currentRotSpeed;

    // Apply Gravity
    const g = (this.world.gravity ?? -9.81) * this.gravityScale
    this.fallSpeed += (g * 0.06) * dt

    const forward = mesh.forward;
    
    // Calculate Target Velocity (Local Space relative to mesh rotation)
    // We want to move in the direction we are facing *at that moment*.
    // But for inertia, we should maintain momentum in world space?
    // If we rotate while sliding, do we slide sideways (drifting)? Yes, that's "frenado natural".
    // So we should track velocity in World Space or Local Space?
    // Usually FPS controls are Local Space for input, but momentum is World Space.
    // However, simpler implementation is Local Space velocity.
    
    // Let's implement robust Vector3 interpolation for velocity.
    
    let inputDir = new BABYLON.Vector3(0,0,0);
    if (this.input.forward) inputDir.addInPlace(forward);
    if (this.input.backward) inputDir.addInPlace(forward.scale(-0.6)); // Backwards is slower
    
    if (inputDir.lengthSquared() > 0.001) {
        inputDir.normalize();
        inputDir.scaleInPlace(targetSpeed);
    }
    
    // Interpolate current velocity towards target input velocity
    const isMoving = inputDir.lengthSquared() > 0.001;
    const lerpFactor = isMoving ? this.movementConfig.acceleration : this.movementConfig.deceleration;
    
    // We only interpolate X and Z. Y is handled by gravity.
    const targetVelXZ = new BABYLON.Vector3(inputDir.x, 0, inputDir.z);
    const currentVelXZ = new BABYLON.Vector3(this.currentVelocity.x, 0, this.currentVelocity.z);
    
    const newVelXZ = BABYLON.Vector3.Lerp(currentVelXZ, targetVelXZ, lerpFactor * dt);
    this.currentVelocity.x = newVelXZ.x;
    this.currentVelocity.z = newVelXZ.z;
    
    // Apply to move vector
    let moveVector = this.currentVelocity.clone();
    moveVector.y = this.fallSpeed; // Apply gravity component

    mesh.moveWithCollisions(moveVector);
    const planar = new BABYLON.Vector3(moveVector.x, 0, moveVector.z)
    
    // Ground Check
    // If we stopped falling or moved very little vertically, we are grounded
    // Or simple raycast check?
    // moveWithCollisions handles the stop. We just need to reset fallSpeed if we hit ground.
    
    // Check if we hit ground by comparing previous Y
    // But Babylon doesn't give collision info on moveWithCollisions easily.
    // Simple heuristic: If we were falling and didn't move down, we hit ground.
    // However, simpler is just: check for collision below.
    const ray = new BABYLON.Ray(mesh.position, new BABYLON.Vector3(0, -1, 0), 1.0);
    const hit = this.world.scene.pickWithRay(ray, (m) => m !== mesh && m.checkCollisions);
    
    if (hit.hit && hit.distance < 0.95) { // 0.9 is pivot to feet (height 1.8)
        this.isGrounded = true;
        this.fallSpeed = Math.max(0, this.fallSpeed);
    } else {
        this.isGrounded = false;
    }

    if (this.isGrounded && planar.lengthSquared() > 0.0001) {
      this.stepTimer += dt
      const interval = this.input.sprint ? 0.28 : 0.38
      if (this.stepTimer >= interval) {
        this.stepTimer = 0
        const audios = this.world?.assetManager?.audios
        const s = audios?.get ? audios.get(this.stepAlt ? 'step1' : 'step2') : null
        if (s?.play) s.play()
        this.stepAlt = !this.stepAlt
      }
    } else {
      this.stepTimer = 0
    }
    
    // Prevent infinite fall if off map
    if (mesh.position.y < -50) {
        mesh.position.copyFrom(this.world.startPosition);
        this.fallSpeed = 0;
    }
  }
}
