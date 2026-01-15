const { sequelize, Type, Status, Space, Room, RoomConnection, Item, Translation, TranslationText } = require('./src/database/models');

async function seed() {
  try {
    // Force sync to clear DB and recreate tables
    await sequelize.sync({ force: true });
    console.log('Database synced!');

    // 1. Catalogs
    const types = await Type.bulkCreate([
      { type: 'image', description: 'Imagen 2D (JPG, PNG)' },
      { type: 'model', description: 'Modelo 3D (GLB, GLTF)' },
      { type: 'video', description: 'Video MP4' },
      { type: 'audio', description: 'Audio MP3/WAV' },
      { type: 'text', description: 'Texto plano o HTML' }
    ]);

    const statuses = await Status.bulkCreate([
      { status: 'active', description: 'Visible y funcional', id_type: 1 },
      { status: 'inactive', description: 'No visible', id_type: 1 },
      { status: 'maintenance', description: 'En reparación', id_type: 1 }
    ]);

    // 2. Space (The Museum)
    const museum = await Space.create({
      name: 'Museo Principal',
      description: 'Espacio principal de exhibición con múltiples salas.',
      img: 'museum_thumb.jpg',
      id_type: 1,
      id_status: 1,
      id_usuario: 1 // Dummy user
    });

    // 3. Rooms (Based on World.js hardcoded layout)
    // We convert the Vector3 positions from World.js to DB fields
    
    // Lobby
    const lobby = await Room.create({
      name: 'Lobby',
      width: 20, height: 14, depth: 20,
      posX: 0, posY: 7, posZ: 0,
      floorMat: 'floor_onyx',
      wallMat: 'asphalt_06_',
      ceilingMat: 'ceiling',
      id_space: museum.id
    });

    // Hallway
    const hallway = await Room.create({
      name: 'Hallway',
      width: 10, height: 10, depth: 30,
      posX: 0, posY: 5, posZ: 25, // z = 0 + 20/2 + 30/2 = 25
      floorMat: 'floor_onyx',
      wallMat: 'asphalt_06_',
      id_space: museum.id
    });

    // Gallery
    const gallery = await Room.create({
      name: 'Gallery',
      width: 40, height: 18, depth: 40,
      posX: 0, posY: 9, posZ: 60, // z = 25 + 30/2 + 40/2 = 60
      floorMat: 'floor_onyx',
      wallMat: 'asphalt_06_',
      id_space: museum.id
    });

    // StairRoom
    const stairRoom = await Room.create({
      name: 'StairRoom',
      width: 25, height: 40, depth: 30,
      posX: 32.5, posY: 20, posZ: 60, // x = 0 + 40/2 + 25/2 = 32.5
      floorMat: 'floor_onyx',
      wallMat: 'asphalt_06_',
      noCeiling: true,
      id_space: museum.id
    });

    // UpperFloor
    const upperFloor = await Room.create({
      name: 'UpperFloor',
      width: 25, height: 12, depth: 25,
      posX: 32.5, posY: 26, posZ: 60, // y = 20 (StairRoom Y) + 20 (Stairs height) roughly
      floorMat: 'floor_onyx',
      wallMat: 'asphalt_06_',
      noCeiling: true,
      id_space: museum.id
    });

    // WestWing
    const westWing = await Room.create({
      name: 'WestWing',
      width: 25, height: 12, depth: 30,
      posX: -22.5, posY: 6, posZ: 0, // x = 0 - 20/2 - 25/2 = -22.5
      floorMat: 'floor_onyx',
      wallMat: 'asphalt_06_',
      id_space: museum.id
    });

    // Basement
    const basement = await Room.create({
      name: 'Basement',
      width: 20, height: 10, depth: 20,
      posX: -22.5, posY: -6, posZ: 0, // y = 6 - 12
      floorMat: 'floor_onyx',
      wallMat: 'asphalt_06_',
      id_space: museum.id
    });

    // 4. Room Connections (Doors/Passages)
    // Lobby <-> Hallway (North)
    await RoomConnection.create({ fromRoomId: lobby.id, toRoomId: hallway.id, direction: 'north', type: 'open' });
    await RoomConnection.create({ fromRoomId: hallway.id, toRoomId: lobby.id, direction: 'south', type: 'open' });

    // Lobby <-> WestWing (West)
    await RoomConnection.create({ fromRoomId: lobby.id, toRoomId: westWing.id, direction: 'west', type: 'open' });
    await RoomConnection.create({ fromRoomId: westWing.id, toRoomId: lobby.id, direction: 'east', type: 'open' });

    // Hallway <-> Gallery (North)
    await RoomConnection.create({ fromRoomId: hallway.id, toRoomId: gallery.id, direction: 'north', type: 'open' });
    await RoomConnection.create({ fromRoomId: gallery.id, toRoomId: hallway.id, direction: 'south', type: 'open' });

    // Gallery <-> StairRoom (East)
    await RoomConnection.create({ fromRoomId: gallery.id, toRoomId: stairRoom.id, direction: 'east', type: 'open' });
    await RoomConnection.create({ fromRoomId: stairRoom.id, toRoomId: gallery.id, direction: 'west', type: 'open' });

    // StairRoom <-> UpperFloor (Up/Down handled by physics/stairs logic, but we link logical neighbors)
    await RoomConnection.create({ fromRoomId: stairRoom.id, toRoomId: upperFloor.id, direction: 'up', type: 'stairs' });

    // WestWing <-> Basement (Down)
    await RoomConnection.create({ fromRoomId: westWing.id, toRoomId: basement.id, direction: 'down', type: 'stairs' });

    // 5. Items (Artworks)
    // Using textures as dummy items
    
    // Item in Lobby
    await Item.create({
      name: 'Bienvenida',
      description: 'El comienzo del recorrido.',
      file: 'textures/room_thumbnail.png',
      type_id: 1, // Image
      id_room: lobby.id,
      posX: 0, posY: 2, posZ: 9.8, // Near North wall
      rotY: 0,
      scale: 2,
      id_status: 1
    });

    // Item in Gallery
    await Item.create({
      name: 'La Madera',
      description: 'Textura procedural de madera noble.',
      file: 'textures/wood.jpg',
      type_id: 1,
      id_room: gallery.id,
      posX: -19.8, posY: 3, posZ: 0, // West wall
      rotY: Math.PI / 2,
      scale: 3,
      id_status: 1
    });

    // Item in Gallery 2
    await Item.create({
      name: 'El Suelo',
      description: 'Detalle del material del suelo.',
      file: 'textures/floor.png',
      type_id: 1,
      id_room: gallery.id,
      posX: 19.8, posY: 3, posZ: 0, // East wall
      rotY: -Math.PI / 2,
      scale: 3,
      id_status: 1
    });

    // 6. i18n Translations
    const transWelcome = await Translation.create({ key: 'welcome_title', namespace: 'ui' });
    await TranslationText.create({ translation_id: transWelcome.id, locale: 'es-419', text: 'Bienvenido al Museo' });
    await TranslationText.create({ translation_id: transWelcome.id, locale: 'en', text: 'Welcome to the Museum' });

    const transEnter = await Translation.create({ key: 'enter_btn', namespace: 'ui' });
    await TranslationText.create({ translation_id: transEnter.id, locale: 'es-419', text: 'Entrar' });
    await TranslationText.create({ translation_id: transEnter.id, locale: 'en', text: 'Enter' });

    const transExamine = await Translation.create({ key: 'examine_prompt', namespace: 'ui' });
    await TranslationText.create({ translation_id: transExamine.id, locale: 'es-419', text: '[➡] Examinar' });
    await TranslationText.create({ translation_id: transExamine.id, locale: 'en', text: '[➡] Examine' });

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
