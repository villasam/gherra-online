const { drawCard, drawLives } = require('./cards');

const {
    countAlivePlayers,
    getWinner
} = require('./rooms');

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

function resetPlayersForGame(room) {
    room.players = room.players.map((player) => {
        return {
            id: player.id,
            name: player.name,
            ready: false,
            lives: drawLives(),
            defense: drawCard(),
            charges: [],
            alive: true
        };
    });
}

function startGame(room) {
    room.status = 'playing';
    room.currentTurnIndex = 0;
    room.winnerId = null;
    room.winnerName = null;
    room.lastAction = 'La partita è iniziata.';

    resetPlayersForGame(room);
}

function resetRoomToLobby(room) {
    room.status = 'lobby';
    room.currentTurnIndex = 0;
    room.winnerId = null;
    room.winnerName = null;
    room.lastAction = null;

    room.players = room.players.map((player) => {
        return {
            id: player.id,
            name: player.name,
            ready: false
        };
    });
}

function canAutoStart(room) {
    if (room.status !== 'lobby') {
        return false;
    }

    if (room.players.length < 2) {
        return false;
    }

    return room.players.every((player) => player.ready);
}

module.exports = {
    nextTurn,
    checkVictory,
    startGame,
    resetRoomToLobby,
    canAutoStart
};