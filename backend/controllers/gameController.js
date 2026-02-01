const Game = require("../models/Game");
const wsService = require("../services/websocketService");

class GameController {
	constructor(lobbyController) {
		this.lobbyController = lobbyController;
	}

	startGame(ws, clientData) {
		const lobby = this.lobbyController.getLobby(clientData.lobbyId);

		if (!lobby) {
			wsService.sendToClient(ws, { type: "error", message: "Not in a lobby" });
			return;
		}

		if (lobby.leader !== clientData.id) {
			wsService.sendToClient(ws, { type: "error", message: "Only leader can start game" });
			return;
		}

		const canStart = lobby.canStartGame();
		if (!canStart.canStart) {
			wsService.sendToClient(ws, { type: "error", message: canStart.error });
			return;
		}

		lobby.game = new Game(lobby.players, lobby.settings.winLength);

		console.log("Game started in lobby:", lobby.id, "Win length:", lobby.game.winLength);

		wsService.broadcastToLobbyIncludingSender(lobby, {
			type: "gameStarted",
			game: lobby.game.toJSON(),
		});

		// Send turn notification to first player
		const firstPlayer = lobby.getPlayer(lobby.game.currentPlayer);
		if (firstPlayer) {
			wsService.sendToClient(firstPlayer.ws, {
				type: "yourTurn",
				message: "It's your turn!",
			});
		}
	}

	makeMove(ws, message, clientData) {
		const lobby = this.lobbyController.getLobby(clientData.lobbyId);

		if (!lobby || !lobby.game) {
			wsService.sendToClient(ws, { type: "error", message: "Game not found" });
			return;
		}

		const currentPlayer = lobby.getPlayer(clientData.id);
		if (!currentPlayer) {
			wsService.sendToClient(ws, { type: "error", message: "Player not found" });
			return;
		}

		const { x, y } = message;
		const result = lobby.game.makeMove(clientData.id, x, y, currentPlayer.symbol);

		if (!result.success) {
			wsService.sendToClient(ws, { type: "error", message: result.error });
			return;
		}

		console.log("Move made at", x, y, "checking win with length:", lobby.game.winLength);

		if (result.gameOver) {
			console.log("Player won!", currentPlayer.name, "Winning cells:", result.winningCells);

			wsService.broadcastToLobbyIncludingSender(lobby, {
				type: "gameOver",
				winner: {
					id: currentPlayer.id,
					name: currentPlayer.name,
					symbol: currentPlayer.symbol,
				},
				winningCells: result.winningCells,
				move: result.move,
			});
		} else {
			const nextPlayer = lobby.getPlayer(result.nextPlayer);
			const nextSymbol = lobby.game.getNextPlayerSymbol(lobby.players);

			wsService.broadcastToLobbyIncludingSender(lobby, {
				type: "moveMade",
				move: result.move,
				nextPlayer: result.nextPlayer,
				nextSymbol: nextSymbol,
			});

			// Send turn notification to next player
			if (nextPlayer) {
				wsService.sendToClient(nextPlayer.ws, {
					type: "yourTurn",
					message: "It's your turn!",
				});
			}
		}
	}
}

module.exports = GameController;
