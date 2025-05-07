const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

// List of valid countries and cities
const countries = [
    "afghanistan", "albania", "algeria", "andorra", "angola", "antigua and barbuda", "argentina", "armenia", "australia", "austria", "azerbaijan",
    "bahamas", "bahrain", "bangladesh", "barbados", "belarus", "belgium", "belize", "benin", "bhutan", "bolivia", "bosnia and herzegovina", "botswana", "brazil", "brunei", "bulgaria", "burkina faso", "burundi",
    "cabo verde", "cambodia", "cameroon", "canada", "central african republic", "chad", "chile", "china", "colombia", "comoros", "congo", "costa rica", "croatia", "cuba", "cyprus", "czech republic",
    "denmark", "djibouti", "dominica", "dominican republic",
    "ecuador", "egypt", "el salvador", "equatorial guinea", "eritrea", "estonia", "eswatini", "ethiopia",
    "fiji", "finland", "france",
    "gabon", "gambia", "georgia", "germany", "ghana", "greece", "grenada", "guatemala", "guinea", "guinea-bissau", "guyana",
    "haiti", "honduras", "hungary",
    "iceland", "india", "indonesia", "iran", "iraq", "ireland", "israel", "italy",
    "jamaica", "japan", "jordan",
    "kazakhstan", "kenya", "kiribati", "korea north", "korea south", "kosovo", "kuwait", "kyrgyzstan",
    "laos", "latvia", "lebanon", "lesotho", "liberia", "libya", "liechtenstein", "lithuania", "luxembourg",
    "madagascar", "malawi", "malaysia", "maldives", "mali", "malta", "marshall islands", "mauritania", "mauritius", "mexico", "micronesia", "moldova", "monaco", "mongolia", "montenegro", "morocco", "mozambique", "myanmar",
    "namibia", "nauru", "nepal", "netherlands", "new zealand", "nicaragua", "niger", "nigeria", "north macedonia", "norway",
    "oman",
    "pakistan", "palau", "panama", "papua new guinea", "paraguay", "peru", "philippines", "poland", "portugal",
    "qatar",
    "romania", "russia", "rwanda",
    "saint kitts and nevis", "saint lucia", "saint vincent and the grenadines", "samoa", "san marino", "sao tome and principe", "saudi arabia", "senegal", "serbia", "seychelles", "sierra leone", "singapore", "slovakia", "slovenia", "solomon islands", "somalia", "south africa", "south sudan", "spain", "sri lanka", "sudan", "suriname", "sweden", "switzerland", "syria",
    "taiwan", "tajikistan", "tanzania", "thailand", "timor-leste", "togo", "tonga", "trinidad and tobago", "tunisia", "turkey", "turkmenistan", "tuvalu",
    "uganda", "ukraine", "united arab emirates", "united kingdom", "united states", "uruguay", "uzbekistan",
    "vanuatu", "vatican city", "venezuela", "vietnam",
    "yemen",
    "zambia", "zimbabwe"
];



const app = express();
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const rooms = {};

io.on("connection", socket => {
    console.log("New client connected");

    socket.on("createRoom", ({ roomCode, playerName }) => {
        if (rooms[roomCode]) {
            socket.emit("roomAlreadyExists");
            return;
        }

        rooms[roomCode] = {
            players: [],
            currentWord: null,
            currentTurnIndex: 0,
        };

        joinRoom(socket, roomCode, playerName);
        socket.emit("roomCreated");
        socket.emit("showStartWordOption");
    });

    socket.on("joinRoom", ({ roomCode, playerName }) => {
        if (!rooms[roomCode]) {
            socket.emit("roomNotFound");
            return;
        }

        joinRoom(socket, roomCode, playerName);
        socket.emit("roomJoined");
    });

    socket.on("startGame", ({ roomCode, firstWord }) => {
        const room = rooms[roomCode];
        if (!room || room.players.length < 2) return;

        const word = firstWord?.toLowerCase() || null;

        if (!word) {
            socket.emit("invalidFirstWord");
            return;
        }

        if (!countries.includes(word) && !cities.includes(word)) {
            socket.emit("invalidFirstWord");
            return;
        }

        room.currentWord = word;
        const startingPlayer = room.players[0];
        startingPlayer.score += 10;

        // Get country code for flag
        const countryCode = getCountryCode(word);
        const flagUrl = countryCode ? `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png` : null;

        io.to(roomCode).emit("wordAccepted", { 
            currentWord: room.currentWord,
            players: room.players,
            flagUrl: flagUrl
        });
        updatePlayers(roomCode);

        room.currentTurnIndex = 1 % room.players.length;
        enableTurn(roomCode);
    });

    socket.on("sendWord", ({ roomCode, word }) => {
        const room = rooms[roomCode];
        if (!room || !room.currentWord) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || player !== room.players[room.currentTurnIndex]) return;

        const lastChar = room.currentWord.slice(-1);
        const newWord = word?.toLowerCase();

        if (!newWord || !newWord.startsWith(lastChar)) {
            player.lives--;
            socket.emit("wrongWord", { message: "Wrong word! The word must start with the last letter of the previous word" });
            checkLives(roomCode);
            nextTurn(roomCode);
        } else if (!countries.includes(newWord) && !cities.includes(newWord)) {
            player.lives--;
            socket.emit("wrongWord", { message: "Invalid word! Please enter a valid country or city name" });
            checkLives(roomCode);
            nextTurn(roomCode);
        } else {
            room.currentWord = newWord;
            player.score += 10;

            // Get country code for flag
            const countryCode = getCountryCode(newWord);
            const flagUrl = countryCode ? `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png` : null;

            io.to(roomCode).emit("wordAccepted", { 
                currentWord: newWord,
                players: room.players,
                flagUrl: flagUrl
            });
            nextTurn(roomCode);
        }
    });

    socket.on("timeUp", ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || player !== room.players[room.currentTurnIndex]) return;

        player.lives--;
        socket.emit("wrongWord", { message: "Time's up! You lost a life" });
        checkLives(roomCode);
        nextTurn(roomCode);
    });

    socket.on("disconnect", () => {
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const index = room.players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                room.players.splice(index, 1);
                if (room.players.length === 0) {
                    delete rooms[roomCode];
                } else {
                    updatePlayers(roomCode);
                    if (room.currentTurnIndex >= room.players.length) {
                        room.currentTurnIndex = 0;
                    }
                }
                break;
            }
        }
    });

    function joinRoom(socket, roomCode, playerName) {
        socket.join(roomCode);
        const player = { id: socket.id, name: playerName, lives: 3, score: 0 };
        rooms[roomCode].players.push(player);
        updatePlayers(roomCode);
    }

    function updatePlayers(roomCode) {
        const room = rooms[roomCode];
        io.to(roomCode).emit("updatePlayers", room.players);
    }

    function enableTurn(roomCode) {
        const room = rooms[roomCode];
        if (!room || room.players.length === 0) return;

        const currentPlayer = room.players[room.currentTurnIndex];
        io.to(roomCode).emit("startTimer", 30);
        io.to(currentPlayer.id).emit("yourTurn");
        
        // Emit notYourTurn to all other players
        room.players.forEach(player => {
            if (player.id !== currentPlayer.id) {
                io.to(player.id).emit("notYourTurn");
            }
        });
    }

    function nextTurn(roomCode) {
        const room = rooms[roomCode];
        if (!room || room.players.length === 0) return;

        room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
        updatePlayers(roomCode);
        enableTurn(roomCode);
    }

    function checkLives(roomCode) {
        const room = rooms[roomCode];
        if (!room) return;

        // Check for eliminated players
        const eliminatedPlayers = room.players.filter(p => p.lives <= 0);
        if (eliminatedPlayers.length > 0) {
            eliminatedPlayers.forEach(player => {
                io.to(player.id).emit("playerEliminated");
            });
        }

        // Remove eliminated players
        room.players = room.players.filter(p => p.lives > 0);

        if (room.players.length === 1) {
            io.to(roomCode).emit("gameOver", { 
                name: room.players[0].name,
                players: room.players
            });
            delete rooms[roomCode];
        } else if (room.players.length === 0) {
            io.to(roomCode).emit("gameOver", { 
                name: "No one",
                players: []
            });
            delete rooms[roomCode];
        } else {
            if (room.currentTurnIndex >= room.players.length) {
                room.currentTurnIndex = 0;
            }
        }
    }

    // Add country code mapping function
    function getCountryCode(countryName) {
        const countryCodes = {
            "india": "in",
            "china": "cn",
            "usa": "us",
            "japan": "jp",
            "germany": "de",
            "france": "fr",
            "italy": "it",
            "spain": "es",
            "brazil": "br",
            "canada": "ca",
            "australia": "au",
            "russia": "ru",
            "uk": "gb",
            "mexico": "mx",
            "south korea": "kr",
            "thailand": "th",
            "vietnam": "vn",
            "malaysia": "my",
            "singapore": "sg",
            "indonesia": "id",
            "philippines": "ph",
            "egypt": "eg",
            "south africa": "za",
            "nigeria": "ng",
            "kenya": "ke",
            "morocco": "ma",
            "tanzania": "tz"
        };
        return countryCodes[countryName.toLowerCase()] || null;
    }
});

server.listen(3000, () => {
    console.log("Server is running on port 3000");
});
