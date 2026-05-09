function drawCard() {
    return Math.floor(Math.random() * 10) + 1;
}

function drawLives() {
    return drawCard() + drawCard() + drawCard() + drawCard();
}

module.exports = {
    drawCard,
    drawLives
};