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

// Čuvamo liste pesama u memoriji servera
const rooms = {};


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
        // Fetch the room details from the database
        const [rows] = await connection.execute(
            'SELECT username, room_name, max_users FROM rooms WHERE room_code = ?',
            [roomCode]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Kod sobe nije pronađen!' });
        }

        const roomCreator = rows[0].username;
        const roomName = rows[0].room_name;
        const maxUsers = rows[0].max_users;

        // Get the current number of users in the room
        const [userCountRows] = await connection.execute(
            'SELECT COUNT(*) as userCount FROM room_users WHERE room_code = ?',
            [roomCode]
        );

        const currentUserCount = userCountRows[0].userCount;

        if (currentUserCount >= maxUsers) {
            return res.status(403).json({ error: 'Soba je puna!' });
        }

        console.log(`📢 Server šalje: roomName = ${roomName}, roomCode = ${roomCode}`);

        const isCreator = username === roomCreator;

        // Insert the user into the room (assuming there's a `room_users` table)
        await connection.execute(
            'INSERT INTO room_users (room_code, username) VALUES (?, ?)',
            [roomCode, username]
        );

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




// Endpoint za zaboravljenu lozinku
app.post('/forgotPassword', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email je obavezan!' });
  }

  try {
    // Proveri da li postoji korisnik sa ovim emailom
    const [rows] = await connection.execute(
      'SELECT username FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Email nije pronađen u sistemu!' });
    }

    const username = rows[0].username;

    // Generiši novu lozinku
    const newPassword = generateRandomPassword();

    // Ažuriraj lozinku u bazi
    await connection.execute(
      'UPDATE users SET password = ? WHERE email = ?',
      [newPassword, email]
    );

    // Pošalji email sa novom lozinkom
    try {
      await sendEmail(
        email,
        'Resetovanje lozinke za MusicRoom nalog',
        `Poštovani ${username},\n\nVaša nova lozinka je: ${newPassword}\n\nMolimo vas da je promenite nakon prijave.\n\nPozdrav,\nMusicRoom tim`
      );
      console.log(`Nova lozinka poslana na ${email}`);
      res.status(200).json({ message: 'Nova lozinka poslana na vaš email!' });
    } catch (error) {
      console.error('Greška pri slanju emaila:', error);
      res.status(500).json({ error: 'Greška pri slanju emaila.' });
    }
  } catch (error) {
    console.error('Greška pri resetovanju lozinke:', error);
    res.status(500).json({ error: 'Greška sa bazom podataka.' });
  }
});

// Funkcija za generisanje nasumične lozinke
function generateRandomPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Funkcija za slanje emaila
async function sendEmail(recipientEmail, subject, message) {
  const nodemailer = require('nodemailer');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'alenmahmutovic2@gmail.com', // Tvoj email
      pass: 'zsvy weot zaek ayzw', // App Password za tvoj email
    },
  });

  await transporter.sendMail({
    from: 'alenmahmutovic2@gmail.com',
    to: recipientEmail,
    subject: subject,
    text: message,
  });
}


// Endpoint za promenu lozinke
app.post('/changePassword', async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;

  if (!username || !oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Sva polja su obavezna!' });
  }

  try {
    // Proveri da li korisnik postoji sa starom lozinkom
    const [rows] = await connection.execute(
      'SELECT * FROM users WHERE username = ? AND password = ?',
      [username, oldPassword]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Pogrešno korisničko ime ili lozinka!' });
    }

    // Ažuriraj lozinku
    await connection.execute(
      'UPDATE users SET password = ? WHERE username = ?',
      [newPassword, username]
    );

    console.log(`Lozinka uspešno promenjena za korisnika: ${username}`);
    res.status(200).json({ message: 'Lozinka uspešno promenjena!' });
  } catch (error) {
    console.error('Greška pri promeni lozinke:', error);
    res.status(500).json({ error: 'Greška sa bazom podataka.' });
  }
});

// Endpoint za registraciju korisnika
app.post('/register', async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({ error: 'Sva polja su obavezna!' });
  }

  try {
    // Dodaj korisnika u tabelu `users`
    const [result] = await connection.execute(
      'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
      [username, password, email]
    );

    console.log(`Korisnik "${username}" je uspešno registrovan.`);
    res.status(201).json({ message: 'Korisnik uspešno registrovan!' });
  } catch (error) {
    console.error('Greška pri registraciji korisnika:', error);
    res.status(500).json({ error: 'Greška sa bazom podataka.' });
  }
});

// Endpoint za prijavu korisnika
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Sva polja su obavezna!' });
  }

  try {
    // Proveri korisničko ime i lozinku u bazi
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
    console.error('Greška pri proveri korisnika u bazi:', error);
    res.status(500).json({ error: 'Greška sa bazom podataka.' });
  }
});

// Updated createRoom endpoint
app.post('/createRoom', async (req, res) => {
  const { room_name, max_users, room_code, username } = req.body;

  if (!room_name || !max_users || !room_code || !username) {
    return res.status(400).json({ error: 'Sva polja su obavezna!' });
  }

  try {
    await connection.execute(
      'INSERT INTO rooms (room_name, max_users, room_code, username) VALUES (?, ?, ?, ?)',
      [room_name, max_users, room_code, username]
    );

    console.log(`✅ Soba "${room_name}" kreirana sa kodom: ${room_code} od strane korisnika: ${username}`);

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
                const { roomCode } = data;

                if (!rooms[roomCode]) {
                    rooms[roomCode] = new Map(); // Koristimo Map za lakše praćenje jedinstvenih pjesama
                }

                ws.roomCode = roomCode;

                console.log(`👤 Novi korisnik se pridružio sobi: ${roomCode}`);

                // Konvertuj Map u Array za slanje
                const songsArray = Array.from(rooms[roomCode].values());

                ws.send(JSON.stringify({
                    type: 'roomJoined',
                    songs: songsArray,
                }));

                break;
            }

            case 'addSong': {
                const { roomCode, song } = data;

                if (!rooms[roomCode]) {
                    rooms[roomCode] = new Map();
                }

                // Kreiraj jedinstveni ključ za pjesmu
                const songKey = `${song.title}-${song.artist}`;

                if (rooms[roomCode].has(songKey)) {
                    // Ako pjesma već postoji, povećaj broj glasova
                    const existingSong = rooms[roomCode].get(songKey);
                    existingSong.votes = (existingSong.votes || 1) + 1;
                    
                    // Premjesti pjesmu na početak liste
                    rooms[roomCode].delete(songKey);
                    rooms[roomCode].set(songKey, existingSong);
                    
                    console.log(`🎵 Dodan novi glas za pjesmu: "${song.title}" u sobi: ${roomCode}`);
                } else {
                    // Ako je nova pjesma, dodaj je sa jednim glasom
                    song.votes = 1;
                    rooms[roomCode].set(songKey, song);
                    console.log(`🎵 Dodana nova pjesma: "${song.title}" u sobi: ${roomCode}`);
                }

                // Konvertuj Map u Array za slanje
                const updatedSongs = Array.from(rooms[roomCode].values());

                // Pošalji svim korisnicima u toj sobi
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

                // Kreiraj jedinstveni ključ za pesmu
                const songKey = `${song.title}-${song.artist}`;

                // Ukloni pesmu iz sobe
                if (rooms[roomCode].has(songKey)) {
                    rooms[roomCode].delete(songKey);
                    console.log(`🎵 Pesma "${song.title}" je uklonjena iz sobe: ${roomCode}`);
                }

                // Konvertuj Map u Array za slanje
                const updatedSongs = Array.from(rooms[roomCode].values());

                // Pošaljite svim korisnicima u sobi ažuriranu listu pesama
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

                console.log(`🔊 playSong primljen: "${song.title}" iz sobe: ${roomCode}`);

                if (!rooms[roomCode]) return;

                // Ukloni pjesmu iz Map-e
                const songKey = `${song.title}-${song.artist}`;
                rooms[roomCode].delete(songKey);

                // Konvertuj Map u Array za slanje
                const updatedSongs = Array.from(rooms[roomCode].values());

                console.log(`🗑️ Šaljem updateQueue svim klijentima u sobi: ${roomCode}`);

                // Pošaljite svim korisnicima u toj sobi
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
        }
    });

    ws.on('close', () => {
        console.log('🚪 Klijent se isključio');
    });
});

  ws.on('close', () => {
    console.log('🚪 Klijent se isključio');
  });
});

// Pokreni server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server pokrenut na ws://0.0.0.0:${PORT}`);
});




