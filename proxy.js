import express from "express";
import axios from "axios";

const app = express();

app.get("/chatroom/:username", async (req, res) => {
    try {
        const { username } = req.params;
        const result = await axios.get(
            `https://kick.com/api/v2/channels/${username}/chatroom`,
            { headers: { "User-Agent": "Mozilla/5.0" } } // tarayıcı gibi davran
        );
        res.json(result.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => console.log("Proxy hazır: http://localhost:3000"));
