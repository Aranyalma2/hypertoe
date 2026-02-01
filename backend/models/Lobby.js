class Lobby {
	constructor(id, leaderId, leaderName, settings = {}) {
		this.id = id;
		this.leader = leaderId;
		this.players = [
			{
				id: leaderId,
				name: leaderName,
				ws: null,
				symbol: null,
				ready: false,
			},
		];
		this.spectators = [];
		this.settings = {
			winLength: settings.winLength || 3,
			maxPlayers: settings.maxPlayers || 4,
		};
		this.game = null;
	}

	addPlayer(id, name, ws) {
		if (this.players.length >= this.settings.maxPlayers) {
			return { success: false, error: "Lobby is full" };
		}

		const player = {
			id,
			name,
			ws,
			symbol: null,
			ready: false,
		};

		this.players.push(player);
		return { success: true, player };
	}

	addSpectator(id, name, ws) {
		const spectator = { id, name, ws };
		this.spectators.push(spectator);
		return { success: true, spectator };
	}

	removePlayer(playerId) {
		const index = this.players.findIndex((p) => p.id === playerId);
		if (index !== -1) {
			this.players.splice(index, 1);
			return true;
		}
		return false;
	}

	removeSpectator(spectatorId) {
		const index = this.spectators.findIndex((s) => s.id === spectatorId);
		if (index !== -1) {
			this.spectators.splice(index, 1);
			return true;
		}
		return false;
	}

	getPlayer(playerId) {
		return this.players.find((p) => p.id === playerId);
	}

	getSpectator(spectatorId) {
		return this.spectators.find((s) => s.id === spectatorId);
	}

	updateSettings(settings) {
		if (settings.winLength) {
			this.settings.winLength = parseInt(settings.winLength);
		}
		if (settings.maxPlayers) {
			const newMaxPlayers = parseInt(settings.maxPlayers);
			if (newMaxPlayers < this.players.length) {
				return {
					success: false,
					error: `Cannot set max players to ${newMaxPlayers}. There are already ${this.players.length} players in the lobby.`,
				};
			}
			this.settings.maxPlayers = newMaxPlayers;
		}
		return { success: true };
	}

	claimSymbol(playerId, symbol) {
		const player = this.getPlayer(playerId);
		if (!player) {
			return { success: false, error: "Player not found" };
		}

		const symbolTaken = this.players.some((p) => p.symbol === symbol && p.id !== playerId);
		if (symbolTaken) {
			return { success: false, error: "Symbol already taken" };
		}

		player.symbol = symbol;
		player.ready = false;
		return { success: true, player };
	}

	toggleReady(playerId) {
		const player = this.getPlayer(playerId);
		if (!player) {
			return { success: false, error: "Player not found" };
		}

		if (!player.symbol) {
			return { success: false, error: "Please select a symbol first" };
		}

		player.ready = !player.ready;
		return { success: true, player };
	}

	switchPlayerToSpectator(playerId) {
		const playerIndex = this.players.findIndex((p) => p.id === playerId);
		if (playerIndex === -1) {
			return { success: false, error: "Player not found" };
		}

		const player = this.players[playerIndex];

		if (this.leader === player.id && this.players.length > 1) {
			this.leader = this.players.find((p) => p.id !== player.id).id;
		} else if (this.leader === player.id && this.players.length === 1) {
			return { success: false, error: "Cannot become spectator as the only player" };
		}

		this.players.splice(playerIndex, 1);
		const spectator = { id: player.id, name: player.name, ws: player.ws };
		this.spectators.push(spectator);

		return { success: true, spectator, newLeader: this.leader };
	}

	switchSpectatorToPlayer(spectatorId) {
		if (this.players.length >= this.settings.maxPlayers) {
			return { success: false, error: "Lobby is full" };
		}

		const spectatorIndex = this.spectators.findIndex((s) => s.id === spectatorId);
		if (spectatorIndex === -1) {
			return { success: false, error: "Spectator not found" };
		}

		const spectator = this.spectators[spectatorIndex];
		this.spectators.splice(spectatorIndex, 1);

		const player = {
			id: spectator.id,
			name: spectator.name,
			ws: spectator.ws,
			symbol: null,
			ready: false,
		};
		this.players.push(player);

		return { success: true, player };
	}

	canStartGame() {
		if (this.players.length < 2) {
			return { canStart: false, error: "Need at least 2 players" };
		}

		const allReady = this.players.every((p) => p.ready && p.symbol);
		if (!allReady) {
			return { canStart: false, error: "All players must select a symbol and be ready" };
		}

		return { canStart: true };
	}

	resetPlayersReady() {
		this.players.forEach((p) => (p.ready = false));
	}

	isEmpty() {
		return this.players.length === 0 && this.spectators.length === 0;
	}

	toJSON() {
		return {
			id: this.id,
			leader: this.leader,
			players: this.players.map((p) => ({
				id: p.id,
				name: p.name,
				symbol: p.symbol,
				ready: p.ready,
			})),
			spectators: this.spectators.map((s) => ({
				id: s.id,
				name: s.name,
			})),
			settings: this.settings,
			game: this.game ? this.game.toJSON() : null,
		};
	}
}

module.exports = Lobby;
