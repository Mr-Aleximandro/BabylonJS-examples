const express = require('express');
const cors = require('cors');
const path = require('path');
const { Space, Room, RoomConnection, Item, Translation, TranslationText } = require('./src/database/models');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '')));

// API Routes

// Get full Space structure (Space -> Rooms -> Connections -> Items)
app.get('/api/space/:id/structure', async (req, res) => {
  try {
    const spaceId = req.params.id;
    
    // Fetch Space
    const space = await Space.findByPk(spaceId);
    if (!space) return res.status(404).json({ error: 'Space not found' });

    // Fetch Rooms for this Space
    const rooms = await Room.findAll({ 
      where: { id_space: spaceId }
    });

    // Fetch Items for these Rooms
    const items = await Item.findAll({
      where: { id_room: rooms.map(r => r.id) }
    });

    // Fetch Connections between these rooms
    const connections = await RoomConnection.findAll({
      where: {
        fromRoomId: rooms.map(r => r.id)
      }
    });

    res.json({
      space,
      rooms,
      items,
      connections
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// Get Translations
app.get('/api/translations/:locale', async (req, res) => {
  try {
    const { locale } = req.params;
    
    const translations = await Translation.findAll({
      include: [{
        model: TranslationText,
        where: { locale },
        required: true // Inner join
      }]
    });

    // Format: { "key": "text" }
    const dictionary = {};
    translations.forEach(t => {
      if (t.TranslationTexts.length > 0) {
        dictionary[t.key] = t.TranslationTexts[0].text;
      }
    });

    res.json(dictionary);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
