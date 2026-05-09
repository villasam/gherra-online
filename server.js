const express = require('express');
const path = require('path');
const http = require('http');

const { Server } = require('socket.io');

const { drawCard } = require('./game/cards');

const {
    createUniqueRoomCode,
    findPlayer,
    getLobbyPlayers,
    getCurrentTurnPlayer
} = require('./game/rooms');

const {
    nextTurn,
    checkVictory,
    startGame,
    resetRoomToLobby,
    canAutoStart
} = require('./game/rules');

const {
    sendLobbyState,
    sendGameStarted,
    sendGameState
} = require('./game/state');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

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

io.on('connection', (socket) => {
    console.log('Utente collegato:', socket.id);

    socket.on('createRoom', (playerName) => {
        const roomCode = createUniqueRoomCode(rooms);

        const room = {
            code: roomCode,
            status: 'lobby',
            currentTurnIndex: 0,
            winnerId: null,
            winnerName: null,
            lastAction: null,
            players: [
                {
                    id: socket.id,
                    name: playerName,
                    ready: false
                }
            ]
        };

        rooms.set(roomCode, room);
        socket.join(roomCode);

        socket.emit('roomJoined', {
            roomCode: roomCode,
            players: getLobbyPlayers(room)
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
            name: playerName,
            ready: false
        });

        socket.join(roomCode);

        socket.emit('roomJoined', {
            roomCode: roomCode,
            players: getLobbyPlayers(room)
        });

        sendLobbyState(io, room);

        console.log(`${playerName} è entrato nella stanza ${roomCode}`);
    });

    socket.on('toggleReady', (roomCode) => {
        if (!rooms.has(roomCode)) {
            socket.emit('errorMessage', 'Stanza non trovata.');
            return;
        }

        const room = rooms.get(roomCode);

        if (room.status !== 'lobby') {
            socket.emit('errorMessage', 'La partita è già iniziata.');
            return;
        }

        const player = findPlayer(room, socket.id);

        if (!player) {
            socket.emit('errorMessage', 'Giocatore non trovato.');
            return;
        }

        player.ready = !player.ready;

        if (canAutoStart(room)) {
            startGame(room);
            sendGameStarted(io, room);
        }
        else {
            sendLobbyState(io, room);
        }
    });

    socket.on('restartToLobby', (roomCode) => {
        if (!rooms.has(roomCode)) {
            socket.emit('errorMessage', 'Stanza non trovata.');
            return;
        }

        const room = rooms.get(roomCode);

        if (room.status !== 'finished') {
            socket.emit('errorMessage', 'La partita non è ancora finita.');
            return;
        }

        resetRoomToLobby(room);

        io.to(room.code).emit('roomJoined', {
            roomCode: room.code,
            players: getLobbyPlayers(room)
        });

        sendLobbyState(io, room);
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

        currentPlayer.charges.push(drawCard());

        room.lastAction =
            `${currentPlayer.name} ha caricato una carta coperta.`;

        nextTurn(room);
        sendGameState(io, room);
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
        sendGameState(io, room);
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

        const chargesText =
            usedCharges.length === 0
            ? 'nessun carico'
            : usedCharges.join(' + ');

        if (targetPlayer.defense >= attackValue) {
            room.lastAction = {
                type: 'attack',
                attackerName: attacker.name,
                targetName: targetPlayer.name,
                attackCard: attackCard,
                usedCharges: usedCharges,
                chargeSum: chargeSum,
                attackValue: attackValue,
                defense: targetPlayer.defense,
                damage: 0,
                blocked: true,
                targetLostCharges: false,
                targetEliminated: false,
                text: `${attacker.name} attacca ${targetPlayer.name}.`
            };
        }
        else {
            const damage = attackValue - targetPlayer.defense;
            const lostChargeCount = targetPlayer.charges.length;

            targetPlayer.lives -= damage;
            targetPlayer.charges = [];

            if (targetPlayer.lives <= 0) {
                targetPlayer.lives = 0;
                targetPlayer.alive = false;

                room.lastAction = {
                    type: 'attack',
                    attackerName: attacker.name,
                    targetName: targetPlayer.name,
                    attackCard: attackCard,
                    usedCharges: usedCharges,
                    chargeSum: chargeSum,
                    attackValue: attackValue,
                    defense: targetPlayer.defense,
                    damage: damage,
                    blocked: false,
                    targetLostCharges: lostChargeCount > 0,
                    lostChargeCount: lostChargeCount,
                    targetEliminated: true,
                    text: `${attacker.name} attacca ${targetPlayer.name}.`
                };
            }
            else {
                room.lastAction = {
                    type: 'attack',
                    attackerName: attacker.name,
                    targetName: targetPlayer.name,
                    attackCard: attackCard,
                    usedCharges: usedCharges,
                    chargeSum: chargeSum,
                    attackValue: attackValue,
                    defense: targetPlayer.defense,
                    damage: damage,
                    blocked: false,
                    targetLostCharges: lostChargeCount > 0,
                    lostChargeCount: lostChargeCount,
                    targetEliminated: false,
                    text: `${attacker.name} attacca ${targetPlayer.name}.`
                };
            }
        }

        if (room.status !== 'finished') {
            nextTurn(room);
        }

        sendGameState(io, room);
    });

    socket.on('disconnect', () => {
        console.log('Utente disconnesso:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server avviato su http://localhost:${PORT}`);
});