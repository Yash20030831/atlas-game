const socket = io();

let currentRoom = null;
let playerName = null;
let timerInterval = null;

function createRoom() {
    const roomCode = document.getElementById("roomCode").value;
    playerName = document.getElementById("playerName").value;

    if (!roomCode || !playerName) {
        showMessage("Please enter both room code and player name");
        return;
    }

    currentRoom = roomCode;
    socket.emit("createRoom", { roomCode, playerName });
}

function joinRoom() {
    const roomCode = document.getElementById("roomCode").value;
    playerName = document.getElementById("playerName").value;

    if (!roomCode || !playerName) {
        showMessage("Please enter both room code and player name");
        return;
    }

    currentRoom = roomCode;
    socket.emit("joinRoom", { roomCode, playerName });
}

function startGame() {
    const firstWord = document.getElementById("firstWord").value;
    if (!firstWord) {
        showMessage("Please enter a word to start the game");
        return;
    }
    
    if (!currentRoom) {
        showMessage("Error: No room selected. Please create or join a room first.");
        return;
    }
    
    console.log("Attempting to start game with word:", firstWord, "in room:", currentRoom);
    socket.emit("startGame", { roomCode: currentRoom, firstWord });
}

function sendWord() {
    const word = document.getElementById("newWord").value;
    if (!word) {
        showMessage("Please enter a word");
        return;
    }
    socket.emit("sendWord", { roomCode: currentRoom, word });
    document.getElementById("newWord").value = "";
}

function startTimer(seconds) {
    // Clear any existing timer
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    const status = document.getElementById("status");
    status.textContent = `Time remaining: ${seconds} seconds`;
    
    timerInterval = setInterval(() => {
        seconds--;
        status.textContent = `Time remaining: ${seconds} seconds`;
        
        if (seconds <= 0) {
            clearInterval(timerInterval);
            status.textContent = "Time's up!";
            // Automatically pass the turn if time runs out
            socket.emit("timeUp", { roomCode: currentRoom });
        }
    }, 1000);
}

function showMessage(message, type = 'error') {
    const messageContainer = document.getElementById("messageContainer");
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    messageContainer.appendChild(messageDiv);
    
    // Remove the message after 3 seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

socket.on("roomCreated", () => {
    document.getElementById("lobby").style.display = "none";
    document.getElementById("game").classList.remove("hidden");
    document.getElementById("playerNameDisplay").classList.remove("hidden");
    document.querySelector(".scoreboard-container").classList.remove("hidden");
    document.getElementById("currentPlayerName").textContent = playerName;
});

socket.on("roomJoined", () => {
    document.getElementById("lobby").style.display = "none";
    document.getElementById("game").classList.remove("hidden");
    document.getElementById("playerNameDisplay").classList.remove("hidden");
    document.querySelector(".scoreboard-container").classList.remove("hidden");
    document.getElementById("currentPlayerName").textContent = playerName;
});

socket.on("roomAlreadyExists", () => {
    showMessage("Room already exists");
});

socket.on("roomNotFound", () => {
    showMessage("Error: Room not found. Please check the room code.");
    console.log("Room not found:", currentRoom);
});

socket.on("invalidFirstWord", () => {
    showMessage("Please enter a valid country or city name to start the game");
    console.log("Invalid first word entered");
});

socket.on("wrongWord", ({ message }) => {
    const errorMessage = document.getElementById("errorMessage");
    errorMessage.textContent = message;
    errorMessage.style.display = "block";
    
    // Clear the error message after 3 seconds
    setTimeout(() => {
        errorMessage.style.display = "none";
    }, 3000);
});

async function fetchCountryDetails(countryName) {
    try {
        const response = await fetch(`https://restcountries.com/v3.1/name/${countryName}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data[0];
    } catch (error) {
        console.error('Error fetching country details:', error);
        return null;
    }
}

function displayDetails(details) {
    const detailsPanel = document.getElementById("detailsPanel");
    const detailsContent = document.getElementById("detailsContent");
    
    if (!details) {
        detailsPanel.classList.add("hidden");
        return;
    }

    detailsPanel.classList.remove("hidden");
    
    const detailItems = [
        { label: "Capital", value: details.capital?.[0] || "N/A" },
        { label: "Continent", value: details.continents?.[0] || "N/A" },
        { label: "Population", value: details.population?.toLocaleString() || "N/A" },
        { label: "Area", value: `${details.area?.toLocaleString()} km²` || "N/A" },
        { label: "Currency", value: Object.values(details.currencies || {})[0]?.name || "N/A" },
        { label: "Languages", value: Object.values(details.languages || {}).join(", ") || "N/A" }
    ];

    detailsContent.innerHTML = detailItems.map(item => `
        <div class="detail-item">
            <div class="detail-label">${item.label}</div>
            <div class="detail-value">${item.value}</div>
        </div>
    `).join('');
}

socket.on("wordAccepted", async ({ currentWord, flagUrl }) => {
    document.getElementById("currentWord").textContent = `Current word: ${currentWord}`;
    document.getElementById("errorMessage").style.display = "none";
    showMessage("Word accepted! +10 points", "success");
    
    // Display flag if available
    const flagContainer = document.getElementById("flagContainer");
    if (flagUrl) {
        flagContainer.innerHTML = `<img src="${flagUrl}" alt="${currentWord} flag" class="country-flag">`;
        flagContainer.style.display = "block";
    } else {
        flagContainer.style.display = "none";
    }
    
    // Fetch and display details for the word
    const details = await fetchCountryDetails(currentWord);
    displayDetails(details);
});

socket.on("startGame", async ({ firstWord, flagUrl }) => {
    document.getElementById("currentWord").textContent = `Current word: ${firstWord}`;
    document.getElementById("errorMessage").style.display = "none";
    showMessage("Game started!", "success");
    
    // Display flag if available
    const flagContainer = document.getElementById("flagContainer");
    if (flagUrl) {
        flagContainer.innerHTML = `<img src="${flagUrl}" alt="${firstWord} flag" class="country-flag">`;
        flagContainer.style.display = "block";
    } else {
        flagContainer.style.display = "none";
    }
    
    // Fetch and display details for the first word
    const details = await fetchCountryDetails(firstWord);
    displayDetails(details);
});

socket.on("showStartWordOption", () => {
    document.getElementById("startWordInput").style.display = "block";
    document.getElementById("turnInput").style.display = "none";
    document.getElementById("status").textContent = "Enter the first word to start the game!";
});

socket.on("yourTurn", () => {
    document.getElementById("turnInput").style.display = "block";
    document.getElementById("startWordInput").style.display = "none";
    document.getElementById("status").textContent = "It's your turn!";
    // Enable input and button
    document.getElementById("newWord").disabled = false;
    document.querySelector("#turnInput .btn").disabled = false;
    // Start timer when it's player's turn
    startTimer(30);
});

socket.on("notYourTurn", () => {
    document.getElementById("turnInput").style.display = "block";
    document.getElementById("startWordInput").style.display = "none";
    document.getElementById("status").textContent = "Waiting for your turn...";
    // Disable input and button
    document.getElementById("newWord").disabled = true;
    document.querySelector("#turnInput .btn").disabled = true;
});

socket.on("updatePlayers", (players) => {
    const playersList = document.getElementById("players");
    playersList.innerHTML = "";

    players.forEach((player, index) => {
        const playerDiv = document.createElement("div");
        playerDiv.className = index === currentTurnIndex ? "current-turn" : "";
        
        const playerInfo = document.createElement("div");
        playerInfo.className = "player-info";
        
        const nameSpan = document.createElement("span");
        nameSpan.textContent = player.name;
        
        const scoreSpan = document.createElement("span");
        scoreSpan.textContent = `🏆 ${player.score}`;
        
        const livesSpan = document.createElement("span");
        livesSpan.textContent = `❤️ ${player.lives}`;
        
        playerInfo.appendChild(nameSpan);
        playerInfo.appendChild(scoreSpan);
        playerInfo.appendChild(livesSpan);
        playerDiv.appendChild(playerInfo);
        playersList.appendChild(playerDiv);
    });
});

socket.on("playerEliminated", () => {
    const gameContainer = document.getElementById("game");
    gameContainer.innerHTML = `
        <div class="eliminated-message card">
            <h2>You are eliminated!</h2>
            <p>You can still watch the game until it ends.</p>
        </div>
    `;
    // Clear timer when eliminated
    if (timerInterval) {
        clearInterval(timerInterval);
    }
});

socket.on("gameOver", (winner) => {
    const gameContainer = document.getElementById("game");
    let message = "";
    
    if (winner.name === "No one") {
        message = "Game Over! No one wins!";
    } else {
        message = `Game Over! ${winner.name} wins!`;
    }
    
    gameContainer.innerHTML = `
        <div class="final-scoreboard card">
            <h2>Game Over!</h2>
            <h3>${message}</h3>
            <div class="final-scores">
                ${winner.players.map(player => `
                    <div class="final-score-item">
                        <span class="player-name">${player.name}</span>
                        <span class="player-score">🏆 ${player.score}</span>
                        <span class="player-lives">❤️ ${player.lives}</span>
                    </div>
                `).join('')}
            </div>
            <div class="final-buttons">
                <button class="btn" onclick="location.reload()">Replay</button>
                <button class="btn" onclick="window.location.href='/'">OK</button>
            </div>
        </div>
    `;
    // Clear timer when game ends
    if (timerInterval) {
        clearInterval(timerInterval);
    }
});

let currentTurnIndex = 0;

socket.on("startTimer", (seconds) => {
    startTimer(seconds);
});
