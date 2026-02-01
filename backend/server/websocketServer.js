const WebSocket = require("ws");
const wsService = require("../services/websocketService");
const { generateClientId } = require("../utils/helpers");

function setupWebSocketServer(server, messageHandler, lobbyController) {
	const wss = new WebSocket.Server({ server });

	wss.on("connection", (ws) => {
		const clientId = generateClientId();
		wsService.setClientData(ws, { id: clientId, lobbyId: null });

		console.log("Client connected:", clientId);

		ws.on("message", (data) => {
			messageHandler.handleMessage(ws, data);
		});

		ws.on("close", () => {
			lobbyController.handleDisconnect(ws);
		});
	});

	return wss;
}

module.exports = setupWebSocketServer;
