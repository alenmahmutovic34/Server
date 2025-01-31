const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 8080;

// Čuvamo liste pesama i korisnika u memoriji servera
const rooms = {};
const usersInRooms = {};

// Povezivanje na MySQL bazu
const dbConfig = {
  host: 'db4free.net',
  user: 'alen123',
  password: 'alen12345678',
  database: 'musicrooms',
};

let connection;

async function connectToDatabase() {
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Uspostavljena veza sa bazom podataka!');
  } catch (error) {
    console.error('❌ Greška pri povezivanju sa bazom:', error);
  }
}

connectToDatabase();

app.post('/joinRoom', async (req, res) => {
    const { roomCode, username } = req.body;

    if (!roomCode || !username) {
        return res.status(400).json({ error: 'Kod sobe i korisničko ime su obavezni!' });
    }

    try {
        const [rows] = await connection.execute(
            'SELECT username, room_name, max_users, number_users FROM rooms WHERE room_code = ?',
            [roomCode]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Kod sobe nije pronađen!' });
        }

        const roomCreator = rows[0].username;
        const roomName = rows[0].room_name;
        const maxUsers = rows[0].max_users;
        const numberUsers = rows[0].number_users;

        if (numberUsers >= maxUsers) {
            return res.status(400).json({ error: 'Soba je puna!' });
        }

        // Dodaj korisnika u listu korisnika sobe
        if (!usersInRooms[roomCode]) {
            usersInRooms[roomCode] = new Set();
        }
        usersInRooms[roomCode].add(username);

        await connection.execute(
            'UPDATE rooms SET number_users = number_users + 1 WHERE room_code = ?',
            [roomCode]
        );

        const isCreator = username === roomCreator;

        res.status(200).json({
            message: 'Uspešno ste se pridružili sobi!',
            isCreator: isCreator,
            roomName: roomName || "Nepoznato"
        });

    } catch (error) {
        console.error('❌ Greška pri pridruživanju sobi:', error);
        res.status(500).json({ error: 'Greška sa bazom podataka.' });
    }
});

app.post('/register', async (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        return res.status(400).json({ error: 'Sva polja su obavezna!' });
    }

    try {
        const [existingUser] = await connection.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'Korisničko ime je već zauzeto!' });
        }

        await connection.execute(
            'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
            [username, password, email]
        );

        res.status(201).json({ message: 'Korisnik uspešno registrovan!' });
    } catch (error) {
        console.error('Greška pri registraciji:', error);
        res.status(500).json({ error: 'Greška sa bazom podataka.' });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Sva polja su obavezna!' });
    }

    try {
        const [rows] = await connection.execute(
            'SELECT * FROM users WHERE username = ? AND password = ?',
            [username, password]
        );

        if (rows.length > 0) {
            res.status(200).json({ message: 'Prijava uspešna!' });
        } else {
            res.status(401).json({ error: 'Pogrešno korisničko ime ili lozinka!' });
        }
    } catch (error) {
        console.error('Greška pri prijavi:', error);
        res.status(500).json({ error: 'Greška sa bazom podataka.' });
    }
});

app.post('/createRoom', async (req, res) => {
    const { room_name, max_users, room_code, username } = req.body;

    if (!room_name || !max_users || !room_code || !username) {
        return res.status(400).json({ error: 'Sva polja su obavezna!' });
    }

    try {
        await connection.execute(
            'INSERT INTO rooms (room_name, max_users, room_code, username, number_users) VALUES (?, ?, ?, ?, 1)',
            [room_name, max_users, room_code, username]
        );

        // Inicijalizuj listu korisnika za novu sobu
        usersInRooms[room_code] = new Set([username]);

        res.status(201).json({
            message: 'Soba uspešno kreirana!',
            room_name,
            room_code,
            username
        });
    } catch (error) {
        console.error('❌ Greška pri kreiranju sobe:', error);
        res.status(500).json({ error: 'Greška sa bazom podataka.' });
    }
});

wss.on('connection', (ws) => {
    console.log('🎧 Novi klijent povezan');

    ws.on('message', (message) => {
        console.log('📩 SERVER PRIMIO PORUKU:', message);

        const data = JSON.parse(message);

        switch (data.type) {
            case 'joinRoom': {
                const { roomCode, username } = data;

                if (!rooms[roomCode]) {
                    rooms[roomCode] = new Map();
                }

                if (!usersInRooms[roomCode]) {
                    usersInRooms[roomCode] = new Set();
                }
                usersInRooms[roomCode].add(username);
                ws.roomCode = roomCode;
                ws.username = username;

                const songsArray = Array.from(rooms[roomCode].values());

                ws.send(JSON.stringify({
                    type: 'roomJoined',
                    songs: songsArray,
                }));

                // Obavesti sve korisnike o novom korisniku
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN && client.roomCode === roomCode) {
                        client.send(JSON.stringify({
                            type: 'updateUsers',
                            users: Array.from(usersInRooms[roomCode])
                        }));
                    }
                });
                break;
            }

            case 'addSong': {
                const { roomCode, song } = data;

                if (!rooms[roomCode]) {
                    rooms[roomCode] = new Map();
                }

                const songKey = `${song.title}-${song.artist}`;

                if (rooms[roomCode].has(songKey)) {
                    const existingSong = rooms[roomCode].get(songKey);
                    existingSong.votes = (existingSong.votes || 1) + 1;
                    rooms[roomCode].delete(songKey);
                    rooms[roomCode].set(songKey, existingSong);
                } else {
                    song.votes = 1;
                    rooms[roomCode].set(songKey, song);
                }

                const updatedSongs = Array.from(rooms[roomCode].values());

                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN && client.roomCode === roomCode) {
                        client.send(JSON.stringify({
                            type: 'updateQueue',
                            songs: updatedSongs
                        }));
                    }
                });
                break;
            }

            case 'removeSong': {
                const { roomCode, song } = data;

                if (!rooms[roomCode]) return;

                const songKey = `${song.title}-${song.artist}`;
                if (rooms[roomCode].has(songKey)) {
                    rooms[roomCode].delete(songKey);
                }

                const updatedSongs = Array.from(rooms[roomCode].values());

                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN && client.roomCode === roomCode) {
                        client.send(JSON.stringify({
                            type: 'updateQueue',
                            songs: updatedSongs
                        }));
                    }
                });
                break;
            }

            case 'playSong': {
                const { roomCode, song } = data;

                if (!rooms[roomCode]) return;

                const songKey = `${song.title}-${song.artist}`;
                rooms[roomCode].delete(songKey);

                const updatedSongs = Array.from(rooms[roomCode].values());

                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN && client.roomCode === roomCode) {
                        client.send(JSON.stringify({
                            type: 'updateQueue',
                            songs: updatedSongs
                        }));

                        client.send(JSON.stringify({
                            type: 'currentlyPlaying',
                            song: song
                        }));
                    }
                });
                break;
            }

            case 'stopSong': {
                const { roomCode } = data;

                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN && client.roomCode === roomCode) {
                        client.send(JSON.stringify({
                            type: 'currentlyPlaying',
                            song: null
                        }));
                    }
                });
                break;
            }

            case 'leaveRoom': {
                const { roomCode, username } = data;
                
                if (usersInRooms[roomCode]) {
                    usersInRooms[roomCode].delete(username);
                    
                    if (usersInRooms[roomCode].size === 0) {
                        delete usersInRooms[roomCode];
                        delete rooms[roomCode];
                    } else {
                        wss.clients.forEach((client) => {
                            if (client.readyState === WebSocket.OPEN && client.roomCode === roomCode) {
                                client.send(JSON.stringify({
                                    type: 'updateUsers',
                                    users: Array.from(usersInRooms[roomCode])
                                }));
                            }
                        });
                    }
                }

                connection.execute(
                    'UPDATE rooms SET number_users = number_users - 1 WHERE room_code = ?',
                    [roomCode]
                ).catch((error) => {
                    console.error('❌ Greška pri smanjivanju broja korisnika:', error);
                });
                
                break;
            }
        }
    });

    ws.on('close', () => {
        console.log('🚪 Klijent se isključio');
        
        if (ws.roomCode && ws.username) {
            if (usersInRooms[ws.roomCode]) {
                usersInRooms[ws.roomCode].delete(ws.username);
                
                if (usersInRooms[ws.roomCode].size > 0) {
                    wss.clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN && client.roomCode === ws.roomCode) {
                            client.send(JSON.stringify({
                                type: 'updateUsers',
                                users: Array.from(usersInRooms[ws.roomCode])
                            }));
                        }
                    });
                } else {
                    delete usersInRooms[ws.roomCode];
                    delete rooms[ws.roomCode];
                }
            }
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server pokrenut na ws://0.0.0.0:${PORT}`);
});