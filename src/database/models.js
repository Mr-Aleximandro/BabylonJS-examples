const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  mail: { type: DataTypes.STRING(30), unique: true },
  pass: { type: DataTypes.STRING(100) }, // Increased for hash
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  name: { type: DataTypes.STRING(50) },
  lastname: { type: DataTypes.STRING(50) },
  birth: { type: DataTypes.DATEONLY },
  sex: { type: DataTypes.BOOLEAN },
  first_sesion: { type: DataTypes.DATE },
  last_sesion: { type: DataTypes.DATE },
  id_status: { type: DataTypes.INTEGER },
  id_role: { type: DataTypes.INTEGER }
}, { tableName: 'usuario', timestamps: false });

const Space = sequelize.define('Space', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(50) },
  description: { type: DataTypes.STRING(200) },
  img: { type: DataTypes.STRING(50) },
  id_type: { type: DataTypes.INTEGER },
  id_usuario: { type: DataTypes.INTEGER },
  id_status: { type: DataTypes.INTEGER }
}, { tableName: 'space', timestamps: false });

const Room = sequelize.define('Room', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(50) },
  width: { type: DataTypes.FLOAT },
  height: { type: DataTypes.FLOAT },
  depth: { type: DataTypes.FLOAT },
  posX: { type: DataTypes.FLOAT },
  posY: { type: DataTypes.FLOAT },
  posZ: { type: DataTypes.FLOAT },
  floorMat: { type: DataTypes.STRING(50) },
  wallMat: { type: DataTypes.STRING(50) },
  ceilingMat: { type: DataTypes.STRING(50) },
  noCeiling: { type: DataTypes.BOOLEAN, defaultValue: false },
  id_space: { type: DataTypes.INTEGER }
}, { tableName: 'room', timestamps: false });

const RoomConnection = sequelize.define('RoomConnection', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fromRoomId: { type: DataTypes.INTEGER },
  toRoomId: { type: DataTypes.INTEGER },
  direction: { type: DataTypes.STRING(10) }, // north, south, east, west
  type: { type: DataTypes.STRING(20) } // door, open, stairs
}, { tableName: 'room_connection', timestamps: false });

const Item = sequelize.define('Item', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(50) },
  description: { type: DataTypes.STRING(200) },
  file: { type: DataTypes.STRING(50) },
  type_id: { type: DataTypes.INTEGER },
  
  // Transform
  posX: { type: DataTypes.FLOAT, defaultValue: 0 },
  posY: { type: DataTypes.FLOAT, defaultValue: 0 },
  posZ: { type: DataTypes.FLOAT, defaultValue: 0 },
  rotY: { type: DataTypes.FLOAT, defaultValue: 0 },
  scale: { type: DataTypes.FLOAT, defaultValue: 1 },

  order: { type: DataTypes.TINYINT },
  id_status: { type: DataTypes.INTEGER },
  id_room: { type: DataTypes.INTEGER } // Linked to Room, NOT Space directly
}, { tableName: 'items', timestamps: false });

const Type = sequelize.define('Type', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  type: { type: DataTypes.STRING(15) },
  description: { type: DataTypes.STRING(200) }
}, { tableName: 'type', timestamps: false });

const Status = sequelize.define('Status', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  status: { type: DataTypes.STRING(15) },
  description: { type: DataTypes.STRING(200) },
  id_type: { type: DataTypes.INTEGER }
}, { tableName: 'status', timestamps: false });

const Effect = sequelize.define('Effect', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  effect: { type: DataTypes.STRING(15) },
  description: { type: DataTypes.STRING(200) }
}, { tableName: 'effect', timestamps: false });

const ItemEffect = sequelize.define('ItemEffect', {
  item_id: { type: DataTypes.INTEGER, references: { model: Item, key: 'id' } },
  effect_id: { type: DataTypes.INTEGER, references: { model: Effect, key: 'id' } },
  params: { type: DataTypes.JSON } // JSON for flexible params (e.g. speed, color)
}, { tableName: 'item_effect', timestamps: false });

// i18n
const Translation = sequelize.define('Translation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  key: { type: DataTypes.STRING(100), unique: 'key_ns' },
  namespace: { type: DataTypes.STRING(50), defaultValue: 'common', unique: 'key_ns' }
}, { tableName: 'translations', timestamps: false });

const TranslationText = sequelize.define('TranslationText', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  translation_id: { type: DataTypes.INTEGER },
  locale: { type: DataTypes.STRING(10) }, // es-419, en, fr
  text: { type: DataTypes.TEXT }
}, { tableName: 'translation_texts', timestamps: false });

// Relationships
Space.hasMany(Room, { foreignKey: 'id_space' });
Room.belongsTo(Space, { foreignKey: 'id_space' });

Room.hasMany(Item, { foreignKey: 'id_room' });
Item.belongsTo(Room, { foreignKey: 'id_room' });

Item.belongsTo(Type, { foreignKey: 'type_id' });
Item.belongsTo(Status, { foreignKey: 'id_status' });

Item.belongsToMany(Effect, { through: ItemEffect, foreignKey: 'item_id' });
Effect.belongsToMany(Item, { through: ItemEffect, foreignKey: 'effect_id' });

Translation.hasMany(TranslationText, { foreignKey: 'translation_id' });
TranslationText.belongsTo(Translation, { foreignKey: 'translation_id' });

module.exports = {
  sequelize,
  User,
  Space,
  Room,
  RoomConnection,
  Item,
  Type,
  Status,
  Effect,
  ItemEffect,
  Translation,
  TranslationText
};
