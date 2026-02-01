function generateLobbyId() {
	return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateClientId() {
	return Math.random().toString(36).substring(7);
}

module.exports = {
	generateLobbyId,
	generateClientId,
};
