const wsService = require("../services/websocketService");

class MessageHandler {
	constructor(lobbyController, gameController) {
		this.lobbyController = lobbyController;
		this.gameController = gameController;
	}

	handleMessage(ws, data) {
		try {
			const message = JSON.parse(data);
			const clientData = wsService.getClientData(ws);

			switch (message.type) {
				case "setPlayerId":
					if (message.playerId) {
						clientData.id = message.playerId;
						wsService.setClientData(ws, clientData);
						console.log("Player ID set to:", message.playerId);
					}
					break;

				case "restoreSession":
					this.lobbyController.restoreSession(ws, message, clientData);
					break;

				case "createLobby":
					this.lobbyController.createLobby(ws, message, clientData);
					break;

				case "joinLobby":
					this.lobbyController.joinLobby(ws, message, clientData);
					break;

				case "toggleSpectator":
					this.lobbyController.toggleSpectator(ws, clientData);
					break;

				case "claimSymbol":
					this.lobbyController.claimSymbol(ws, message, clientData);
					break;

				case "toggleReady":
					this.lobbyController.toggleReady(ws, clientData);
					break;

				case "updateSettings":
					this.lobbyController.updateSettings(ws, message, clientData);
					break;

				case "startGame":
					this.gameController.startGame(ws, clientData);
					break;

				case "makeMove":
					this.gameController.makeMove(ws, message, clientData);
					break;

				default:
					console.log("Unknown message type:", message.type);
			}
		} catch (error) {
			console.error("Error processing message:", error);
			wsService.sendToClient(ws, { type: "error", message: "Invalid message format" });
		}
	}
}

module.exports = MessageHandler;
