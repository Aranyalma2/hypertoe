const WebSocket = require("ws");

class WebSocketService {
	constructor() {
		this.clients = new Map(); // ws -> {id, lobbyId}
	}

	setClientData(ws, data) {
		this.clients.set(ws, data);
	}

	getClientData(ws) {
		return this.clients.get(ws);
	}

	removeClient(ws) {
		this.clients.delete(ws);
	}

	sendToClient(ws, message) {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message));
		}
	}

	broadcastToLobby(lobby, message, excludeClient = null) {
		// Send to players
		lobby.players.forEach((player) => {
			if (player.ws !== excludeClient && player.ws.readyState === WebSocket.OPEN) {
				player.ws.send(JSON.stringify(message));
			}
		});

		// Send to spectators
		lobby.spectators.forEach((spectator) => {
			if (spectator.ws !== excludeClient && spectator.ws.readyState === WebSocket.OPEN) {
				spectator.ws.send(JSON.stringify(message));
			}
		});
	}

	broadcastToLobbyIncludingSender(lobby, message) {
		// Send to players
		lobby.players.forEach((player) => {
			if (player.ws.readyState === WebSocket.OPEN) {
				player.ws.send(JSON.stringify(message));
			}
		});

		// Send to spectators
		lobby.spectators.forEach((spectator) => {
			if (spectator.ws.readyState === WebSocket.OPEN) {
				spectator.ws.send(JSON.stringify(message));
			}
		});
	}
}

module.exports = new WebSocketService();
