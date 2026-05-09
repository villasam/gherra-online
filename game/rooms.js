function generateRoomCode() {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

    let code = '';

    for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * letters.length);
        code += letters[randomIndex];
    }

    return code;
}

function createUniqueRoomCode(rooms) {
    let roomCode = generateRoomCode();

    while (rooms.has(roomCode)) {
        roomCode = generateRoomCode();
    }

    return roomCode;
}

function findPlayer(room, playerId) {
    return room.players.find((player) => player.id === playerId);
}

function getLobbyPlayers(room) {
    return room.players.map((player) => {
        return {
            id: player.id,
            name: player.name,
            ready: player.ready
        };
    });
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

function getCurrentTurnPlayer(room) {
    return room.players[room.currentTurnIndex];
}

module.exports = {
    createUniqueRoomCode,
    findPlayer,
    getLobbyPlayers,
    countAlivePlayers,
    getWinner,
    getCurrentTurnPlayer
};