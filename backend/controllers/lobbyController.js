const Lobby = require("../models/Lobby");
const wsService = require("../services/websocketService");
const { generateLobbyId } = require("../utils/helpers");

class LobbyController {
	constructor() {
		this.lobbies = new Map();
	}

	createLobby(ws, message, clientData) {
		const lobbyId = generateLobbyId();
		const lobby = new Lobby(lobbyId, clientData.id, message.username, {
			winLength: message.winLength,
			maxPlayers: message.maxPlayers,
		});

		// Set the websocket for the leader
		lobby.players[0].ws = ws;

		this.lobbies.set(lobbyId, lobby);
		clientData.lobbyId = lobbyId;

		wsService.sendToClient(ws, {
			type: "lobbyCreated",
			lobbyId: lobbyId,
			lobby: lobby.toJSON(),
			playerId: clientData.id,
			isSpectator: false,
		});

		console.log("Lobby created:", lobbyId, "Settings:", lobby.settings);
	}

	joinLobby(ws, message, clientData) {
		const lobby = this.lobbies.get(message.lobbyId);

		if (!lobby) {
			wsService.sendToClient(ws, { type: "error", message: "Lobby not found" });
			return;
		}

		const isSpectator = message.asSpectator || false;

		// Check if game is in progress and user wasn't part of it
		if (lobby.game && lobby.game.winner === null && !isSpectator) {
			const wasInGame = lobby.game.activePlayers.includes(clientData.id);

			if (!wasInGame) {
				// Force as spectator if game is active and they weren't in it
				const result = lobby.addSpectator(clientData.id, message.username, ws);
				clientData.lobbyId = message.lobbyId;

				wsService.sendToClient(ws, {
					type: "lobbyJoined",
					lobbyId: lobby.id,
					lobby: lobby.toJSON(),
					playerId: clientData.id,
					isSpectator: true,
					message: "Game in progress - joined as spectator",
				});

				wsService.broadcastToLobby(
					lobby,
					{
						type: "spectatorJoined",
						spectator: { id: result.spectator.id, name: result.spectator.name },
					},
					ws,
				);

				console.log("User joined as spectator (game in progress):", message.lobbyId);
				return;
			}
		}

		if (isSpectator) {
			const result = lobby.addSpectator(clientData.id, message.username, ws);
			clientData.lobbyId = message.lobbyId;

			wsService.sendToClient(ws, {
				type: "lobbyJoined",
				lobbyId: lobby.id,
				lobby: lobby.toJSON(),
				playerId: clientData.id,
				isSpectator: true,
			});

			wsService.broadcastToLobby(
				lobby,
				{
					type: "spectatorJoined",
					spectator: { id: result.spectator.id, name: result.spectator.name },
				},
				ws,
			);

			console.log("User joined as spectator:", message.lobbyId);
		} else {
			const result = lobby.addPlayer(clientData.id, message.username, ws);

			if (!result.success) {
				wsService.sendToClient(ws, { type: "error", message: result.error });
				return;
			}

			clientData.lobbyId = message.lobbyId;

			wsService.sendToClient(ws, {
				type: "lobbyJoined",
				lobbyId: lobby.id,
				lobby: lobby.toJSON(),
				playerId: clientData.id,
				isSpectator: false,
			});

			wsService.broadcastToLobby(
				lobby,
				{
					type: "playerJoined",
					player: {
						id: result.player.id,
						name: result.player.name,
						symbol: result.player.symbol,
						ready: result.player.ready,
					},
				},
				ws,
			);

			console.log("Player joined lobby:", message.lobbyId, "Player count:", lobby.players.length, "/", lobby.settings.maxPlayers);
		}
	}

	restoreSession(ws, message, clientData) {
		const { lobbyId, playerId } = message;
		const lobby = this.lobbies.get(lobbyId);

		if (!lobby) {
			wsService.sendToClient(ws, { type: "sessionRestoreFailed", message: "Lobby not found" });
			return;
		}

		const player = lobby.getPlayer(playerId);
		const spectator = lobby.getSpectator(playerId);

		if (!player && !spectator) {
			wsService.sendToClient(ws, { type: "sessionRestoreFailed", message: "Player not found in lobby" });
			return;
		}

		if (player) {
			player.ws = ws;
			clientData.lobbyId = lobbyId;
			wsService.setClientData(ws, { id: playerId, lobbyId: lobbyId });

			wsService.sendToClient(ws, {
				type: "sessionRestored",
				lobby: lobby.toJSON(),
				playerId: playerId,
				isSpectator: false,
			});
		} else if (spectator) {
			spectator.ws = ws;
			clientData.lobbyId = lobbyId;
			wsService.setClientData(ws, { id: playerId, lobbyId: lobbyId });

			wsService.sendToClient(ws, {
				type: "sessionRestored",
				lobby: lobby.toJSON(),
				playerId: playerId,
				isSpectator: true,
			});
		}

		console.log("Session restored for:", playerId, "in lobby:", lobbyId);
	}

	toggleSpectator(ws, clientData) {
		const lobby = this.lobbies.get(clientData.lobbyId);

		if (!lobby) {
			wsService.sendToClient(ws, { type: "error", message: "Not in a lobby" });
			return;
		}

		if (lobby.game && lobby.game.winner === null) {
			wsService.sendToClient(ws, { type: "error", message: "Cannot change mode during active game" });
			return;
		}

		const player = lobby.getPlayer(clientData.id);
		const spectator = lobby.getSpectator(clientData.id);

		if (player) {
			const result = lobby.switchPlayerToSpectator(clientData.id);

			if (!result.success) {
				wsService.sendToClient(ws, { type: "error", message: result.error });
				return;
			}

			wsService.broadcastToLobbyIncludingSender(lobby, {
				type: "spectatorModeChanged",
				playerId: clientData.id,
				isSpectator: true,
				newLeader: result.newLeader,
			});
		} else if (spectator) {
			const result = lobby.switchSpectatorToPlayer(clientData.id);

			if (!result.success) {
				wsService.sendToClient(ws, { type: "error", message: result.error });
				return;
			}

			wsService.broadcastToLobbyIncludingSender(lobby, {
				type: "spectatorModeChanged",
				playerId: clientData.id,
				isSpectator: false,
			});
		}
	}

	claimSymbol(ws, message, clientData) {
		const lobby = this.lobbies.get(clientData.lobbyId);

		if (!lobby) {
			wsService.sendToClient(ws, { type: "error", message: "Not in a lobby" });
			return;
		}

		const result = lobby.claimSymbol(clientData.id, message.symbol);

		if (!result.success) {
			wsService.sendToClient(ws, { type: "error", message: result.error });
			return;
		}

		wsService.broadcastToLobbyIncludingSender(lobby, {
			type: "symbolClaimed",
			playerId: clientData.id,
			symbol: result.player.symbol,
			ready: result.player.ready,
		});
	}

	toggleReady(ws, clientData) {
		const lobby = this.lobbies.get(clientData.lobbyId);

		if (!lobby) {
			wsService.sendToClient(ws, { type: "error", message: "Not in a lobby" });
			return;
		}

		const result = lobby.toggleReady(clientData.id);

		if (!result.success) {
			wsService.sendToClient(ws, { type: "error", message: result.error });
			return;
		}

		wsService.broadcastToLobbyIncludingSender(lobby, {
			type: "playerReadyChanged",
			playerId: clientData.id,
			ready: result.player.ready,
		});
	}

	updateSettings(ws, message, clientData) {
		const lobby = this.lobbies.get(clientData.lobbyId);

		if (!lobby) {
			wsService.sendToClient(ws, { type: "error", message: "Not in a lobby" });
			return;
		}

		if (lobby.leader !== clientData.id) {
			wsService.sendToClient(ws, { type: "error", message: "Only leader can update settings" });
			return;
		}

		const result = lobby.updateSettings({
			winLength: message.winLength,
			maxPlayers: message.maxPlayers,
		});

		if (!result.success) {
			wsService.sendToClient(ws, { type: "error", message: result.error });
			return;
		}

		console.log("Settings updated for lobby:", lobby.id, "New settings:", lobby.settings);

		wsService.broadcastToLobbyIncludingSender(lobby, {
			type: "settingsUpdated",
			settings: lobby.settings,
		});
	}

	handleDisconnect(ws) {
		const clientData = wsService.getClientData(ws);
		console.log("Client disconnected:", clientData.id);

		if (clientData.lobbyId) {
			const lobby = this.lobbies.get(clientData.lobbyId);

			if (lobby) {
				// If there's an active game, keep the player in the lobby but mark as disconnected
				if (lobby.game && lobby.game.winner === null) {
					const player = lobby.getPlayer(clientData.id);
					if (player) {
						player.ws = null; // Mark as disconnected but keep in lobby
						console.log("Player marked as disconnected during active game:", clientData.id);
						wsService.removeClient(ws);
						return;
					}
				}

				const wasPlayer = lobby.removePlayer(clientData.id);
				const wasSpectator = lobby.removeSpectator(clientData.id);

				if (lobby.isEmpty()) {
					this.lobbies.delete(clientData.lobbyId);
					console.log("Lobby deleted:", clientData.lobbyId);
				} else {
					if (wasPlayer) {
						if (lobby.leader === clientData.id && lobby.players.length > 0) {
							lobby.leader = lobby.players[0].id;
						}

						wsService.broadcastToLobby(lobby, {
							type: "playerLeft",
							playerId: clientData.id,
							newLeader: lobby.leader,
						});
					} else if (wasSpectator) {
						wsService.broadcastToLobby(lobby, {
							type: "spectatorLeft",
							spectatorId: clientData.id,
						});
					}
				}
			}
		}

		wsService.removeClient(ws);
	}

	getLobby(lobbyId) {
		return this.lobbies.get(lobbyId);
	}
}

module.exports = new LobbyController();
