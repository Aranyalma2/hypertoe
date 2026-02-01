const createHttpServer = require("./server/httpServer");
const setupWebSocketServer = require("./server/websocketServer");
const lobbyController = require("./controllers/lobbyController");
const GameController = require("./controllers/gameController");
const MessageHandler = require("./handlers/messageHandler");

// Initialize controllers
const gameController = new GameController(lobbyController);
const messageHandler = new MessageHandler(lobbyController, gameController);

// Create HTTP server
const server = createHttpServer();

// Setup WebSocket server
const wss = setupWebSocketServer(server, messageHandler, lobbyController);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
