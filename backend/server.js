require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let accessToken = '';

// Funktion: Holt ein neues Token von Twitch
async function getTwitchToken() {
    try {
        const response = await axios.post(`https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`);
        accessToken = response.data.access_token;
        console.log("Neues Twitch-Token erhalten!");
    } catch (error) {
        console.error("Fehler beim Holen des Tokens:", error.response.data);
    }
}

app.get('/api/trending-games', async (req, res) => {
    if (!accessToken) await getTwitchToken();

    try {
        const response = await axios({
            url: "https://api.igdb.com/v4/games",
            method: 'POST',
            headers: {
                'Client-ID': process.env.TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${accessToken}`,
            },
            data: "fields name, cover.image_id, rating; where rating > 80 & cover != null; limit 12; sort rating desc;"
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "IGDB Abfrage fehlgeschlagen" });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Proxy-Server läuft auf http://localhost:${PORT}`));