const express = require('express');
const path = require('path');
const http = require('http');

const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

function drawCard() {
    return Math.floor(Math.random() * 10) + 1;
}

function drawLives() {
    return drawCard() + drawCard() + drawCard() + drawCard();
}

function generateRoomCode() {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    let code = '';

    for (let i = 0; i < 4; i++) {
        const randomIndex = Math.floor(Math.random() * letters.length);
        code += letters[randomIndex];
    }

    return code;
}

function getPublicPlayers(room) {
    return room.players.map((player) => {
        return {
            id: player.id,
            name: player.name
        };
    });
}

function getCurrentTurnPlayer(room) {
    return room.players[room.currentTurnIndex];
}

function findPlayer(room, playerId) {
    return room.players.find((player) => player.id === playerId);
}

function countAlivePlayers(room) {
    return room.players.filter((player) => player.alive).length;
}

function getWinner(room) {
    const alivePlayers = room.players.filter((player) => player.alive);

    if (alivePlayers.length === 1) {
        return alivePlayers[0];
    }

    return null;
}

function nextTurn(room) {
    if (countAlivePlayers(room) <= 1) {
        return;
    }

    let nextIndex = room.currentTurnIndex;

    do {
        nextIndex++;

        if (nextIndex >= room.players.length) {
            nextIndex = 0;
        }

    } while (!room.players[nextIndex].alive);

    room.currentTurnIndex = nextIndex;
}

function checkVictory(room) {
    const winner = getWinner(room);

    if (winner) {
        room.status = 'finished';
        room.winnerId = winner.id;
        room.winnerName = winner.name;
        room.lastAction = `Partita finita. Ha vinto ${winner.name}!`;
    }
}

function getStateForPlayer(room, socketId) {
    const me = findPlayer(room, socketId);
    const currentTurnPlayer = getCurrentTurnPlayer(room);

    return {
        roomCode: room.code,
        status: room.status,

        currentTurnPlayerId: currentTurnPlayer.id,
        currentTurnPlayerName: currentTurnPlayer.name,

        winnerId: room.winnerId || null,
        winnerName: room.winnerName || null,

        lastAction: room.lastAction || null,

        me: {
            id: me.id,
            name: me.name,
            lives: me.lives,
            defense: me.defense,
            chargeCount: me.charges.length,
            alive: me.alive
        },

        players: room.players.map((player) => {
            return {
                id: player.id,
                name: player.name,
                lives: player.lives,
                defense: player.defense,
                chargeCount: player.charges.length,
                alive: player.alive
            };
        })
    };
}

function sendGameState(room) {
    room.players.forEach((player) => {
        const state = getStateForPlayer(room, player.id);
        io.to(player.id).emit('gameUpdated', state);
    });
}

function isValidPlayingRoom(socket, roomCode) {
    if (!rooms.has(roomCode)) {
        socket.emit('errorMessage', 'Stanza non trovata.');
        return false;
    }

    const room = rooms.get(roomCode);

    if (room.status !== 'playing') {
        socket.emit('errorMessage', 'La partita non è in corso.');
        return false;
    }

    return true;
}

function isPlayerTurn(socket, room) {
    const currentPlayer = getCurrentTurnPlayer(room);

    if (currentPlayer.id !== socket.id) {
        socket.emit('errorMessage', 'Non è il tuo turno.');
        return false;
    }

    if (!currentPlayer.alive) {
        socket.emit('errorMessage', 'Sei eliminato.');
        return false;
    }

    return true;
}

function resetRoomForNewGame(room) {
    room.status = 'playing';
    room.currentTurnIndex = 0;
    room.winnerId = null;
    room.winnerName = null;
    room.lastAction = 'Nuova partita iniziata.';

    room.players = room.players.map((player) => {
        return {
            id: player.id,
            name: player.name,
            lives: drawLives(),
            defense: drawCard(),
            charges: [],
            alive: true
        };
    });
}

io.on('connection', (socket) => {
    console.log('Utente collegato:', socket.id);

    socket.on('createRoom', (playerName) => {
        let roomCode = generateRoomCode();

        while (rooms.has(roomCode)) {
            roomCode = generateRoomCode();
        }

        const room = {
            code: roomCode,
            hostId: socket.id,
            status: 'lobby',
            currentTurnIndex: 0,
            winnerId: null,
            winnerName: null,
            lastAction: null,
            players: [
                {
                    id: socket.id,
                    name: playerName
                }
            ]
        };

        rooms.set(roomCode, room);
        socket.join(roomCode);

        socket.emit('roomJoined', {
            roomCode: roomCode,
            players: getPublicPlayers(room),
            isHost: true
        });

        console.log(`Stanza creata: ${roomCode}`);
    });

    socket.on('joinRoom', (data) => {
        const roomCode = data.roomCode;
        const playerName = data.playerName;

        if (!rooms.has(roomCode)) {
            socket.emit('errorMessage', 'Stanza non trovata.');
            return;
        }

        const room = rooms.get(roomCode);

        if (room.status !== 'lobby') {
            socket.emit('errorMessage', 'La partita è già iniziata.');
            return;
        }

        room.players.push({
            id: socket.id,
            name: playerName
        });

        socket.join(roomCode);

        io.to(roomCode).emit(
            'playersUpdated',
            getPublicPlayers(room)
        );

        socket.emit('roomJoined', {
            roomCode: roomCode,
            players: getPublicPlayers(room),
            isHost: socket.id === room.hostId
        });

        console.log(`${playerName} è entrato nella stanza ${roomCode}`);
    });

    socket.on('startGame', (roomCode) => {
        if (!rooms.has(roomCode)) {
            socket.emit('errorMessage', 'Stanza non trovata.');
            return;
        }

        const room = rooms.get(roomCode);

        if (socket.id !== room.hostId) {
            socket.emit('errorMessage', 'Solo il creatore può iniziare.');
            return;
        }

        if (room.players.length < 2) {
            socket.emit('errorMessage', 'Servono almeno 2 giocatori.');
            return;
        }

        resetRoomForNewGame(room);
        room.lastAction = 'La partita è iniziata.';

        room.players.forEach((player) => {
            const state = getStateForPlayer(room, player.id);
            io.to(player.id).emit('gameStarted', state);
        });

        console.log(`Partita iniziata nella stanza ${roomCode}`);
    });

    socket.on('restartGame', (roomCode) => {
        if (!rooms.has(roomCode)) {
            socket.emit('errorMessage', 'Stanza non trovata.');
            return;
        }

        const room = rooms.get(roomCode);

        if (room.status !== 'finished') {
            socket.emit('errorMessage', 'La partita non è ancora finita.');
            return;
        }

        resetRoomForNewGame(room);

        sendGameState(room);

        console.log(`Nuova partita iniziata nella stanza ${roomCode}`);
    });

    socket.on('charge', (roomCode) => {
        if (!isValidPlayingRoom(socket, roomCode)) {
            return;
        }

        const room = rooms.get(roomCode);

        if (!isPlayerTurn(socket, room)) {
            return;
        }

        const currentPlayer = getCurrentTurnPlayer(room);

        const card = drawCard();

        currentPlayer.charges.push(card);

        room.lastAction =
            `${currentPlayer.name} ha caricato una carta coperta.`;

        nextTurn(room);
        sendGameState(room);
    });

    socket.on('changeDefense', (data) => {
        const roomCode = data.roomCode;
        const targetId = data.targetId;

        if (!isValidPlayingRoom(socket, roomCode)) {
            return;
        }

        const room = rooms.get(roomCode);

        if (!isPlayerTurn(socket, room)) {
            return;
        }

        const currentPlayer = getCurrentTurnPlayer(room);
        const targetPlayer = findPlayer(room, targetId);

        if (!targetPlayer) {
            socket.emit('errorMessage', 'Giocatore non trovato.');
            return;
        }

        if (!targetPlayer.alive) {
            socket.emit('errorMessage', 'Non puoi scegliere un giocatore eliminato.');
            return;
        }

        targetPlayer.defense = drawCard();

        if (targetPlayer.id === currentPlayer.id) {
            room.lastAction =
                `${currentPlayer.name} ha cambiato la propria difesa.`;
        }
        else {
            room.lastAction =
                `${currentPlayer.name} ha cambiato la difesa di ${targetPlayer.name}.`;
        }

        nextTurn(room);
        sendGameState(room);
    });

    socket.on('attack', (data) => {
        const roomCode = data.roomCode;
        const targetId = data.targetId;
        const chargesToUse = Number(data.chargesToUse);

        if (!isValidPlayingRoom(socket, roomCode)) {
            return;
        }

        const room = rooms.get(roomCode);

        if (!isPlayerTurn(socket, room)) {
            return;
        }

        const attacker = getCurrentTurnPlayer(room);
        const targetPlayer = findPlayer(room, targetId);

        if (!targetPlayer) {
            socket.emit('errorMessage', 'Giocatore non trovato.');
            return;
        }

        if (!targetPlayer.alive) {
            socket.emit('errorMessage', 'Non puoi attaccare un giocatore eliminato.');
            return;
        }

        if (targetPlayer.id === attacker.id) {
            socket.emit('errorMessage', 'Non puoi attaccare te stesso.');
            return;
        }

        if (!Number.isInteger(chargesToUse)) {
            socket.emit('errorMessage', 'Numero di carichi non valido.');
            return;
        }

        if (chargesToUse < 0) {
            socket.emit('errorMessage', 'Numero di carichi non valido.');
            return;
        }

        if (chargesToUse > attacker.charges.length) {
            socket.emit('errorMessage', 'Non hai abbastanza carichi.');
            return;
        }

        const attackCard = drawCard();

        const usedCharges = attacker.charges.splice(0, chargesToUse);

        const chargeSum = usedCharges.reduce((sum, card) => {
            return sum + card;
        }, 0);

        const attackValue = attackCard + chargeSum;

        if (targetPlayer.defense >= attackValue) {
            room.lastAction =
                `${attacker.name} ha attaccato ${targetPlayer.name}: carta ${attackCard} + carichi ${chargeSum} = ${attackValue}. Difesa ${targetPlayer.defense}. Attacco bloccato.`;
        }
        else {
            const damage = attackValue - targetPlayer.defense;

            targetPlayer.lives -= damage;
            targetPlayer.charges = [];

            if (targetPlayer.lives <= 0) {
                targetPlayer.lives = 0;
                targetPlayer.alive = false;

                room.lastAction =
                    `${attacker.name} ha attaccato ${targetPlayer.name}: carta ${attackCard} + carichi ${chargeSum} = ${attackValue}. Difesa ${targetPlayer.defense}. Danno ${damage}. ${targetPlayer.name} è eliminato.`;
            }
            else {
                room.lastAction =
                    `${attacker.name} ha attaccato ${targetPlayer.name}: carta ${attackCard} + carichi ${chargeSum} = ${attackValue}. Difesa ${targetPlayer.defense}. Danno ${damage}. ${targetPlayer.name} perde tutti i carichi.`;
            }
        }

        checkVictory(room);

        if (room.status !== 'finished') {
            nextTurn(room);
        }

        sendGameState(room);
    });

    socket.on('disconnect', () => {
        console.log('Utente disconnesso:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server avviato su http://localhost:${PORT}`);
});