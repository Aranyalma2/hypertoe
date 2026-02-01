class Game {
	constructor(players, winLength) {
		// Randomly shuffle player order
		const playerOrder = [...players].sort(() => Math.random() - 0.5).map((p) => p.id);

		this.board = {};
		this.currentPlayerIndex = 0;
		this.playerOrder = playerOrder;
		this.currentPlayer = playerOrder[0];
		this.currentSymbol = players.find((p) => p.id === playerOrder[0]).symbol;
		this.moveCount = 0;
		this.winner = null;
		this.winningCells = [];
		this.winLength = winLength;
		this.activePlayers = players.map((p) => p.id);
		this.players = players.map((p) => ({ id: p.id, name: p.name, symbol: p.symbol }));
	}

	makeMove(playerId, x, y, symbol) {
		if (this.winner) {
			return { success: false, error: "Game already finished" };
		}

		if (this.currentPlayer !== playerId) {
			return { success: false, error: "Not your turn" };
		}

		const key = `${x},${y}`;
		if (this.board[key]) {
			return { success: false, error: "Cell already taken" };
		}

		this.board[key] = symbol;
		this.moveCount++;

		const winningCells = this.checkWin(x, y, symbol);

		if (winningCells) {
			this.winner = playerId;
			this.winningCells = winningCells;
			return {
				success: true,
				gameOver: true,
				winningCells,
				move: { x, y, symbol },
			};
		}

		// Move to next player
		this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerOrder.length;
		this.currentPlayer = this.playerOrder[this.currentPlayerIndex];

		return {
			success: true,
			gameOver: false,
			nextPlayer: this.currentPlayer,
			move: { x, y, symbol },
		};
	}

	checkWin(x, y, symbol) {
		const directions = [
			[1, 0], // horizontal
			[0, 1], // vertical
			[1, 1], // diagonal
			[1, -1], // diagonal
		];

		for (let [dx, dy] of directions) {
			let count = 1;
			const winningCells = [[x, y]];

			// Check positive direction
			for (let i = 1; i < this.winLength; i++) {
				const key = `${x + dx * i},${y + dy * i}`;
				if (this.board[key] === symbol) {
					count++;
					winningCells.push([x + dx * i, y + dy * i]);
				} else {
					break;
				}
			}

			// Check negative direction
			for (let i = 1; i < this.winLength; i++) {
				const key = `${x - dx * i},${y - dy * i}`;
				if (this.board[key] === symbol) {
					count++;
					winningCells.unshift([x - dx * i, y - dy * i]);
				} else {
					break;
				}
			}

			if (count >= this.winLength) {
				return winningCells;
			}
		}

		return null;
	}

	getNextPlayerSymbol(players) {
		const nextPlayer = players.find((p) => p.id === this.currentPlayer);
		return nextPlayer ? nextPlayer.symbol : null;
	}

	toJSON() {
		return {
			currentPlayer: this.currentPlayer,
			currentSymbol: this.currentSymbol,
			board: this.board,
			moveCount: this.moveCount,
			winner: this.winner,
			playerOrder: this.playerOrder,
			winningCells: this.winningCells,
			winLength: this.winLength,
			activePlayers: this.activePlayers,
			players: this.players,
		};
	}
}

module.exports = Game;
