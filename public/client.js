const socket = io();

const homeSection = document.getElementById('home');
const lobbySection = document.getElementById('lobby');
const gameSection = document.getElementById('game');

const playerNameInput = document.getElementById('playerNameInput');
const roomCodeInput = document.getElementById('roomCodeInput');

const createRoomButton = document.getElementById('createRoomButton');
const joinRoomButton = document.getElementById('joinRoomButton');
const startGameButton = document.getElementById('startGameButton');

const chargeButton = document.getElementById('chargeButton');
const changeDefenseButton = document.getElementById('changeDefenseButton');
const attackButton = document.getElementById('attackButton');
const restartGameButton = document.getElementById('restartGameButton');

const defenseTargetSelect = document.getElementById('defenseTargetSelect');
const attackTargetSelect = document.getElementById('attackTargetSelect');
const chargesToUseInput = document.getElementById('chargesToUseInput');

const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const playersList = document.getElementById('playersList');

const message = document.getElementById('message');

const gameRoomCodeDisplay = document.getElementById('gameRoomCodeDisplay');
const currentTurnDisplay = document.getElementById('currentTurnDisplay');
const winnerMessage = document.getElementById('winnerMessage');

const myNameDisplay = document.getElementById('myNameDisplay');
const myLivesDisplay = document.getElementById('myLivesDisplay');
const myDefenseDisplay = document.getElementById('myDefenseDisplay');
const myChargesDisplay = document.getElementById('myChargesDisplay');

const lastActionDisplay = document.getElementById('lastActionDisplay');
const gamePlayersList = document.getElementById('gamePlayersList');

let currentRoomCode = null;
let myId = null;
let currentTurnPlayerId = null;
let myChargeCount = 0;

socket.on('connect', () => {
    myId = socket.id;
});

createRoomButton.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();

    if (playerName === '') {
        message.textContent = 'Inserisci un nome.';
        return;
    }

    socket.emit('createRoom', playerName);
});

joinRoomButton.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    const roomCode = roomCodeInput.value.trim().toUpperCase();

    if (playerName === '') {
        message.textContent = 'Inserisci un nome.';
        return;
    }

    if (roomCode === '') {
        message.textContent = 'Inserisci il codice stanza.';
        return;
    }

    socket.emit('joinRoom', {
        roomCode: roomCode,
        playerName: playerName
    });
});

startGameButton.addEventListener('click', () => {
    socket.emit('startGame', currentRoomCode);
});

chargeButton.addEventListener('click', () => {
    socket.emit('charge', currentRoomCode);
});

changeDefenseButton.addEventListener('click', () => {
    const targetId = defenseTargetSelect.value;

    socket.emit('changeDefense', {
        roomCode: currentRoomCode,
        targetId: targetId
    });
});

attackButton.addEventListener('click', () => {
    const targetId = attackTargetSelect.value;
    const chargesToUse = Number(chargesToUseInput.value);

    socket.emit('attack', {
        roomCode: currentRoomCode,
        targetId: targetId,
        chargesToUse: chargesToUse
    });
});

restartGameButton.addEventListener('click', () => {
    socket.emit('restartGame', currentRoomCode);
});

socket.on('roomJoined', (data) => {
    currentRoomCode = data.roomCode;

    homeSection.style.display = 'none';
    lobbySection.style.display = 'block';
    gameSection.style.display = 'none';

    roomCodeDisplay.textContent = data.roomCode;

    startGameButton.style.display =
        data.isHost ? 'inline-block' : 'none';

    updatePlayersList(data.players);

    message.textContent = '';
});

socket.on('playersUpdated', (players) => {
    updatePlayersList(players);
});

socket.on('gameStarted', (state) => {
    homeSection.style.display = 'none';
    lobbySection.style.display = 'none';
    gameSection.style.display = 'block';

    renderGameState(state);
});

socket.on('gameUpdated', (state) => {
    renderGameState(state);
});

socket.on('errorMessage', (text) => {
    message.textContent = text;
});

function updatePlayersList(players) {
    playersList.innerHTML = '';

    players.forEach((player) => {
        const li = document.createElement('li');
        li.textContent = player.name;
        playersList.appendChild(li);
    });
}

function renderGameState(state) {
    currentTurnPlayerId = state.currentTurnPlayerId;
    myChargeCount = state.me.chargeCount;

    gameRoomCodeDisplay.textContent = state.roomCode;
    currentTurnDisplay.textContent = state.currentTurnPlayerName;

    myNameDisplay.textContent = state.me.name;
    myLivesDisplay.textContent = state.me.lives;
    myDefenseDisplay.textContent = state.me.defense;
    myChargesDisplay.textContent = state.me.chargeCount;

    lastActionDisplay.textContent = state.lastAction || 'Nessuna azione ancora.';

    if (state.winnerName) {
        winnerMessage.textContent = `Ha vinto ${state.winnerName}!`;
    }
    else {
        winnerMessage.textContent = '';
    }

    if (state.status === 'finished') {
        restartGameButton.style.display = 'inline-block';
    }
    else {
        restartGameButton.style.display = 'none';
    }

    const isMyTurn = currentTurnPlayerId === myId;
    const gameIsFinished = state.status === 'finished';
    const amIAlive = state.me.alive;

    chargeButton.disabled = !isMyTurn || gameIsFinished || !amIAlive;
    changeDefenseButton.disabled = !isMyTurn || gameIsFinished || !amIAlive;
    defenseTargetSelect.disabled = !isMyTurn || gameIsFinished || !amIAlive;

    attackButton.disabled = !isMyTurn || gameIsFinished || !amIAlive;
    attackTargetSelect.disabled = !isMyTurn || gameIsFinished || !amIAlive;
    chargesToUseInput.disabled = !isMyTurn || gameIsFinished || !amIAlive;

    chargesToUseInput.max = myChargeCount;

    if (Number(chargesToUseInput.value) > myChargeCount) {
        chargesToUseInput.value = myChargeCount;
    }

    renderDefenseTargets(state.players);
    renderAttackTargets(state.players);
    renderPlayersList(state.players);

    message.textContent = '';
}

function renderDefenseTargets(players) {
    defenseTargetSelect.innerHTML = '';

    players.forEach((player) => {
        if (!player.alive) {
            return;
        }

        const option = document.createElement('option');
        option.value = player.id;

        if (player.id === myId) {
            option.textContent = `${player.name} (tu)`;
        }
        else {
            option.textContent = player.name;
        }

        defenseTargetSelect.appendChild(option);
    });
}

function renderAttackTargets(players) {
    attackTargetSelect.innerHTML = '';

    players.forEach((player) => {
        if (!player.alive) {
            return;
        }

        if (player.id === myId) {
            return;
        }

        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = player.name;

        attackTargetSelect.appendChild(option);
    });
}

function renderPlayersList(players) {
    gamePlayersList.innerHTML = '';

    players.forEach((player) => {
        const li = document.createElement('li');

        li.textContent =
            `${player.name} | vite: ${player.lives} | difesa: ${player.defense} | carichi: ${player.chargeCount}`;

        if (!player.alive) {
            li.textContent += ' | eliminato';
        }

        gamePlayersList.appendChild(li);
    });
}