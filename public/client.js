const socket = io();

const homeSection = document.getElementById('home');
const lobbySection = document.getElementById('lobby');
const gameSection = document.getElementById('game');

const playerNameInput = document.getElementById('playerNameInput');
const roomCodeInput = document.getElementById('roomCodeInput');

const createRoomButton = document.getElementById('createRoomButton');
const joinRoomButton = document.getElementById('joinRoomButton');
const readyButton = document.getElementById('readyButton');

const chargeButton = document.getElementById('chargeButton');
const changeDefenseButton = document.getElementById('changeDefenseButton');
const attackButton = document.getElementById('attackButton');
const restartGameButton = document.getElementById('restartGameButton');

const defenseTargetSelect = document.getElementById('defenseTargetSelect');
const attackTargetSelect = document.getElementById('attackTargetSelect');

const chargesButtonsContainer = document.getElementById('chargesButtonsContainer');
const selectedChargesDisplay = document.getElementById('selectedChargesDisplay');

const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const playersList = document.getElementById('playersList');
const myReadyDisplay = document.getElementById('myReadyDisplay');
const readyInfoDisplay = document.getElementById('readyInfoDisplay');

const message = document.getElementById('message');

const currentTurnDisplay = document.getElementById('currentTurnDisplay');
const winnerMessage = document.getElementById('winnerMessage');

const lastActionDisplay = document.getElementById('lastActionDisplay');
const gamePlayersList = document.getElementById('gamePlayersList');

let currentRoomCode = null;
let myId = null;
let currentTurnPlayerId = null;
let myChargeCount = 0;
let selectedChargesToUse = 0;
let myReady = false;

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

readyButton.addEventListener('click', () => {
    socket.emit('toggleReady', currentRoomCode);
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

    socket.emit('attack', {
        roomCode: currentRoomCode,
        targetId: targetId,
        chargesToUse: selectedChargesToUse
    });
});

restartGameButton.addEventListener('click', () => {
    socket.emit('restartToLobby', currentRoomCode);
});

socket.on('roomJoined', (data) => {
    currentRoomCode = data.roomCode;

    homeSection.style.display = 'none';
    lobbySection.style.display = 'block';
    gameSection.style.display = 'none';

    roomCodeDisplay.textContent = data.roomCode;

    renderLobby(data.players);

    message.textContent = '';
});

socket.on('lobbyUpdated', (data) => {
    renderLobby(data.players);
});

socket.on('gameStarted', (state) => {
    homeSection.style.display = 'none';
    lobbySection.style.display = 'none';
    gameSection.style.display = 'block';

    selectedChargesToUse = 0;

    renderGameState(state);
});

socket.on('gameUpdated', (state) => {
    renderGameState(state);
});

socket.on('errorMessage', (text) => {
    message.textContent = text;
});

function renderLobby(players) {
    playersList.innerHTML = '';

    const readyCount = players.filter((player) => player.ready).length;

    players.forEach((player) => {
        const li = document.createElement('li');

        const readyText = player.ready ? 'Pronto' : 'Non pronto';

        if (player.id === myId) {
            li.textContent = `${player.name} (tu) - ${readyText}`;
            myReady = player.ready;
        }
        else {
            li.textContent = `${player.name} - ${readyText}`;
        }

        playersList.appendChild(li);
    });

    myReadyDisplay.textContent = myReady ? 'Pronto' : 'Non pronto';
    readyButton.textContent = myReady ? 'Annulla pronto' : 'Pronto';

    if (players.length < 2) {
        readyInfoDisplay.textContent = 'Servono almeno 2 giocatori per iniziare.';
    }
    else {
        readyInfoDisplay.textContent =
            `${readyCount}/${players.length} giocatori pronti. La partita parte quando tutti sono pronti.`;
    }
}

function renderGameState(state) {
    currentTurnPlayerId = state.currentTurnPlayerId;
    myChargeCount = state.me.chargeCount;

    currentTurnDisplay.textContent = state.currentTurnPlayerName;

    lastActionDisplay.textContent = state.lastAction || 'Nessuna azione ancora.';

    if (state.winnerName) {
        winnerMessage.textContent = `Ha vinto ${state.winnerName}!`;
    }
    else {
        winnerMessage.textContent = '';
    }

    if (state.status === 'finished') {
        restartGameButton.style.display = 'block';
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

    if (selectedChargesToUse > myChargeCount) {
        selectedChargesToUse = myChargeCount;
    }

    selectedChargesDisplay.textContent = selectedChargesToUse;

    renderDefenseTargets(state.players);
    renderAttackTargets(state.players);
    renderChargeButtons(
        myChargeCount,
        !isMyTurn || gameIsFinished || !amIAlive
    );
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

function renderChargeButtons(chargeCount, disabled) {
    chargesButtonsContainer.innerHTML = '';

    for (let i = 0; i <= chargeCount; i++) {
        const button = document.createElement('button');

        button.textContent = i;
        button.disabled = disabled;

        if (i === selectedChargesToUse) {
            button.classList.add('selected-charge-button');
        }

        button.addEventListener('click', () => {
            selectedChargesToUse = i;
            selectedChargesDisplay.textContent = selectedChargesToUse;

            renderChargeButtons(chargeCount, disabled);
        });

        chargesButtonsContainer.appendChild(button);
    }
}

function renderPlayersList(players) {
    gamePlayersList.innerHTML = '';

    players.forEach((player) => {
        const card = document.createElement('div');

        card.classList.add('player-card');

        if (player.id === myId) {
            card.classList.add('me-card');
        }

        if (player.id === currentTurnPlayerId) {
            card.classList.add('turn-card');
        }

        if (!player.alive) {
            card.classList.add('dead-card');
        }

        const name = document.createElement('div');
        name.classList.add('player-name');

        if (player.id === myId) {
            name.textContent = `${player.name} (tu)`;
        }
        else {
            name.textContent = player.name;
        }

        const stats = document.createElement('div');
        stats.classList.add('player-stats');

        stats.innerHTML = `
            <span>Vite: <strong>${player.lives}</strong></span>
            <span>Difesa: <strong>${player.defense}</strong></span>
            <span>Carichi: <strong>${player.chargeCount}</strong></span>
        `;

        const status = document.createElement('div');
        status.classList.add('player-status');

        if (!player.alive) {
            status.textContent = 'Eliminato';
        }
        else if (player.id === currentTurnPlayerId) {
            status.textContent = 'Di turno';
        }
        else {
            status.textContent = '';
        }

        card.appendChild(name);
        card.appendChild(stats);
        card.appendChild(status);

        gamePlayersList.appendChild(card);
    });
}