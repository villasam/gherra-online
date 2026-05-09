const {
    findPlayer,
    getCurrentTurnPlayer,
    getLobbyPlayers
} = require('./rooms');

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

function sendLobbyState(io, room) {
    io.to(room.code).emit('lobbyUpdated', {
        roomCode: room.code,
        players: getLobbyPlayers(room)
    });
}

function sendGameStarted(io, room) {
    room.players.forEach((player) => {
        const state = getStateForPlayer(room, player.id);
        io.to(player.id).emit('gameStarted', state);
    });
}

function sendGameState(io, room) {
    room.players.forEach((player) => {
        const state = getStateForPlayer(room, player.id);
        io.to(player.id).emit('gameUpdated', state);
    });
}

module.exports = {
    getStateForPlayer,
    sendLobbyState,
    sendGameStarted,
    sendGameState
};