class HyperToe {
	constructor() {
		this.ws = null;
		this.username = "";
		this.lobbyId = null;
		this.currentLobby = null;
		this.currentGame = null;

		// Load persistent playerId from localStorage
		const savedSession = localStorage.getItem("gameSession");
		if (savedSession) {
			try {
				const session = JSON.parse(savedSession);
				this.myPlayerId = session.playerId;
			} catch (e) {
				this.myPlayerId = null;
			}
		} else {
			this.myPlayerId = null;
		}

		this.myPlayer = null;
		this.isSpectator = false;

		// Canvas properties
		this.canvas = null;
		this.ctx = null;
		this.cellSize = 80;
		this.offsetX = 0;
		this.offsetY = 0;
		this.scale = 1;
		this.isDragging = false;
		this.dragMoved = false;
		this.lastMouseX = 0;
		this.lastMouseY = 0;
		this.dragStartTime = 0;
		this.isRightClick = false;

		this.board = {};
		this.winningCells = [];
		this.winLength = 3;
		this.lastPlacedMove = null;
		this.highlightLastMove = false;
		this.highlightTimeout = null;

		this.availableSymbols = ["X", "O", "△", "◇", "★", "♦", "●", "■"];

		// Canvas event handlers - store references for cleanup
		this.canvasHandlers = {
			mousedown: null,
			mousemove: null,
			mouseup: null,
			mouseleave: null,
			contextmenu: null,
			touchstart: null,
			touchmove: null,
			touchend: null,
			wheel: null,
		};

		this.initEventListeners();
		this.initBackgroundAnimation();
		this.connectWebSocket();
	}

	initBackgroundAnimation() {
		const canvas = document.getElementById("backgroundCanvas");
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		const symbols = ["X", "O", "△", "◇", "★", "♦", "●", "■"];
		const particles = [];
		const gridSize = 100;

		// Create animated particles
		for (let i = 0; i < 15; i++) {
			particles.push({
				x: Math.random() * canvas.width,
				y: Math.random() * canvas.height,
				symbol: symbols[Math.floor(Math.random() * symbols.length)],
				rotation: Math.random() * Math.PI * 2,
				rotationSpeed: (Math.random() - 0.5) * 0.02,
				size: 40 + Math.random() * 40,
				opacity: 0.3 + Math.random() * 0.4,
				vx: (Math.random() - 0.5) * 0.5,
				vy: (Math.random() - 0.5) * 0.5,
			});
		}

		function drawGrid() {
			ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
			ctx.lineWidth = 1;

			for (let x = 0; x < canvas.width; x += gridSize) {
				ctx.beginPath();
				ctx.moveTo(x, 0);
				ctx.lineTo(x, canvas.height);
				ctx.stroke();
			}

			for (let y = 0; y < canvas.height; y += gridSize) {
				ctx.beginPath();
				ctx.moveTo(0, y);
				ctx.lineTo(canvas.width, y);
				ctx.stroke();
			}
		}

		function animate() {
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			drawGrid();

			particles.forEach((particle) => {
				// Update position
				particle.x += particle.vx;
				particle.y += particle.vy;
				particle.rotation += particle.rotationSpeed;

				// Wrap around edges
				if (particle.x < -50) particle.x = canvas.width + 50;
				if (particle.x > canvas.width + 50) particle.x = -50;
				if (particle.y < -50) particle.y = canvas.height + 50;
				if (particle.y > canvas.height + 50) particle.y = -50;

				// Draw symbol
				ctx.save();
				ctx.translate(particle.x, particle.y);
				ctx.rotate(particle.rotation);
				ctx.font = `bold ${particle.size}px Arial`;
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
				ctx.fillText(particle.symbol, 0, 0);
				ctx.restore();
			});

			requestAnimationFrame(animate);
		}

		animate();

		// Handle window resize
		window.addEventListener("resize", () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		});
	}

	saveSession() {
		if (this.lobbyId && this.myPlayerId) {
			localStorage.setItem(
				"gameSession",
				JSON.stringify({
					lobbyId: this.lobbyId,
					playerId: this.myPlayerId,
					username: this.username,
					userId: this.myPlayerId, // Store user ID for session restoration
				}),
			);
		}
	}

	connectWebSocket() {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const wsUrl = `${protocol}//${window.location.host}`;

		this.ws = new WebSocket(wsUrl);

		this.ws.onopen = () => {
			console.log("Connected to server");

			// Send playerId if we have one from localStorage
			if (this.myPlayerId) {
				this.ws.send(
					JSON.stringify({
						type: "setPlayerId",
						playerId: this.myPlayerId,
					}),
				);
			}

			this.tryRestoreSession();
		};

		this.ws.onmessage = (event) => {
			const message = JSON.parse(event.data);
			this.handleMessage(message);
		};

		this.ws.onerror = (error) => {
			console.error("WebSocket error:", error);
		};

		this.ws.onclose = () => {
			console.log("Disconnected from server");
			setTimeout(() => this.connectWebSocket(), 3000);
		};
	}

	saveSession() {
		if (this.myPlayerId) {
			localStorage.setItem(
				"gameSession",
				JSON.stringify({
					lobbyId: this.lobbyId,
					playerId: this.myPlayerId,
					username: this.username,
				}),
			);
		}
	}

	clearSession() {
		localStorage.removeItem("gameSession");
	}

	tryRestoreSession() {
		const sessionData = localStorage.getItem("gameSession");
		if (sessionData && this.ws && this.ws.readyState === WebSocket.OPEN) {
			try {
				const { lobbyId, playerId, username } = JSON.parse(sessionData);
				this.username = username;
				this.myPlayerId = playerId;

				this.ws.send(
					JSON.stringify({
						type: "restoreSession",
						lobbyId: lobbyId,
						playerId: playerId,
					}),
				);
			} catch (error) {
				console.error("Failed to restore session:", error);
				this.clearSession();
			}
		}
	}

	initEventListeners() {
		// Home screen
		document.getElementById("createLobbyBtn").addEventListener("click", () => this.createLobby());
		document.getElementById("joinLobbyBtn").addEventListener("click", () => this.joinLobby());

		// Lobby screen
		document.getElementById("copyLobbyIdBtn").addEventListener("click", () => this.copyLobbyId());
		document.getElementById("updateSettingsBtn").addEventListener("click", () => this.updateSettings());
		document.getElementById("readyBtn").addEventListener("click", () => {
			console.log("Ready button clicked");
			this.toggleReady();
		});
		document.getElementById("startGameBtn").addEventListener("click", () => this.startGame());
		document.getElementById("leaveLobbyBtn").addEventListener("click", () => this.leaveLobby());

		// Game controls
		document.getElementById("zoomInBtn").addEventListener("click", () => this.zoom(1.2));
		document.getElementById("zoomOutBtn").addEventListener("click", () => this.zoom(0.8));
		document.getElementById("resetViewBtn").addEventListener("click", () => this.resetView());
		document.getElementById("showLastMoveBtn").addEventListener("click", () => this.showLastMove());

		// Modal
		document.getElementById("backToLobbyBtn").addEventListener("click", () => this.backToLobby());

		// Enter key handlers
		document.getElementById("usernameInput").addEventListener("keypress", (e) => {
			if (e.key === "Enter") this.createLobby();
		});

		document.getElementById("lobbyIdInput").addEventListener("keypress", (e) => {
			if (e.key === "Enter") this.joinLobby();
		});

		// Add toggle spectator button listener
		document.getElementById("toggleSpectatorBtn").addEventListener("click", () => this.toggleSpectator());
	}

	handleMessage(message) {
		console.log("Received message:", message.type);

		switch (message.type) {
			case "sessionRestored":
				this.lobbyId = message.lobby.id;
				this.currentLobby = message.lobby;
				this.myPlayerId = message.playerId;
				this.isSpectator = message.isSpectator;

				if (!this.isSpectator) {
					this.myPlayer = this.currentLobby.players.find((p) => p.id === this.myPlayerId);
				}

				if (message.lobby.game && message.lobby.game.winner === null) {
					this.currentGame = message.lobby.game;
					this.board = message.lobby.game.board || {};
					this.winningCells = message.lobby.game.winningCells || [];
					this.winLength = message.lobby.game.winLength || 3;
					this.showGameScreen();
				} else {
					this.showLobbyScreen();
				}
				break;

			case "lobbyCreated":
				this.lobbyId = message.lobbyId;
				this.currentLobby = message.lobby;
				this.myPlayerId = message.playerId;
				this.isSpectator = message.isSpectator;
				this.myPlayer = this.currentLobby.players.find((p) => p.id === this.myPlayerId);
				this.saveSession();
				this.showLobbyScreen();
				break;

			case "lobbyJoined":
				this.lobbyId = message.lobbyId;
				this.currentLobby = message.lobby;
				this.myPlayerId = message.playerId;
				this.isSpectator = message.isSpectator;

				if (!this.isSpectator) {
					this.myPlayer = this.currentLobby.players.find((p) => p.id === this.myPlayerId);
				}

				if (message.message) {
					this.showNotification(message.message, "info");
				}

				this.saveSession();

				// If joining an active game (not ended), show game screen instead of lobby
				if (message.lobby.game && message.lobby.game.winner === null) {
					this.currentGame = message.lobby.game;
					this.board = message.lobby.game.board || {};
					this.winningCells = message.lobby.game.winningCells || [];
					this.winLength = message.lobby.game.winLength || 3;
					this.showGameScreen();
				} else {
					this.showLobbyScreen();
				}
				break;

			case "spectatorJoined":
				this.currentLobby.spectators.push(message.spectator);
				this.updateSpectatorsList();
				break;

			case "spectatorLeft":
				this.currentLobby.spectators = this.currentLobby.spectators.filter((s) => s.id !== message.spectatorId);
				this.updateSpectatorsList();
				break;

			case "spectatorModeChanged":
				if (message.playerId === this.myPlayerId) {
					this.isSpectator = message.isSpectator;

					// Refresh lobby state
					if (message.isSpectator) {
						this.myPlayer = null;
						this.currentLobby.spectators.push({
							id: this.myPlayerId,
							name: this.username,
						});
						this.currentLobby.players = this.currentLobby.players.filter((p) => p.id !== this.myPlayerId);
					} else {
						// When becoming a player, add to players list
						const newPlayer = {
							id: this.myPlayerId,
							name: this.username,
							symbol: null,
							ready: false,
						};
						this.currentLobby.players.push(newPlayer);
						this.myPlayer = newPlayer;
						this.currentLobby.spectators = this.currentLobby.spectators.filter((s) => s.id !== this.myPlayerId);
					}
				} else {
					// Update other user's status
					if (message.isSpectator) {
						const player = this.currentLobby.players.find((p) => p.id === message.playerId);
						if (player) {
							this.currentLobby.players = this.currentLobby.players.filter((p) => p.id !== message.playerId);
							this.currentLobby.spectators.push({
								id: player.id,
								name: player.name,
							});
						}
					} else {
						const spectator = this.currentLobby.spectators.find((s) => s.id === message.playerId);
						if (spectator) {
							this.currentLobby.spectators = this.currentLobby.spectators.filter((s) => s.id !== message.playerId);
							// Add them as a player without symbol/ready status initially
							this.currentLobby.players.push({
								id: spectator.id,
								name: spectator.name,
								symbol: null,
								ready: false,
							});
						}
					}
				}

				if (message.newLeader) {
					this.currentLobby.leader = message.newLeader;
				}

				this.showLobbyScreen();
				break;

			case "playerJoined":
				this.currentLobby.players.push(message.player);
				this.updatePlayersList();
				this.updateSymbolSelection();
				break;

			case "playerLeft":
				this.currentLobby.players = this.currentLobby.players.filter((p) => p.id !== message.playerId);
				if (message.newLeader) {
					this.currentLobby.leader = message.newLeader;
					// Update button visibility when leader changes
					this.updateLeaderUI();
				}
				this.updatePlayersList();
				this.updateSymbolSelection();
				this.updateStartButton();
				break;

			case "symbolClaimed":
				const player = this.currentLobby.players.find((p) => p.id === message.playerId);
				if (player) {
					player.symbol = message.symbol;
					player.ready = message.ready;
				}
				if (message.playerId === this.myPlayerId) {
					this.myPlayer = player;
				}
				this.updatePlayersList();
				this.updateSymbolSelection();
				this.updateStartButton();
				break;

			case "playerReadyChanged":
				const readyPlayer = this.currentLobby.players.find((p) => p.id === message.playerId);
				if (readyPlayer) {
					readyPlayer.ready = message.ready;
				}
				if (message.playerId === this.myPlayerId) {
					this.myPlayer = readyPlayer;
					this.updateReadyButton();
				}
				this.updatePlayersList();
				this.updateStartButton();
				break;

			case "settingsUpdated":
				this.currentLobby.settings = message.settings;
				console.log("Settings updated:", this.currentLobby.settings);
				this.updateSettingsDisplay();
				break;

			case "gameStarted":
				this.currentGame = message.game;
				this.board = {};
				this.winningCells = [];
				this.lastPlacedMove = null;
				this.highlightLastMove = false;
				this.winLength = message.game.winLength || 3;
				console.log("Game started with win length:", this.winLength);
				this.showGameScreen();
				break;

			case "yourTurn":
				this.showNotification(message.message, "success");
				break;

			case "moveMade":
				this.board[`${message.move.x},${message.move.y}`] = message.move.symbol;
				this.lastPlacedMove = { x: message.move.x, y: message.move.y };
				this.currentGame.currentPlayer = message.nextPlayer;
				this.currentGame.currentSymbol = message.nextSymbol;
				this.highlightLastMoveTemporarily();
				this.updateTurnInfo();
				this.drawBoard();
				break;

			case "gameOver":
				this.board[`${message.move.x},${message.move.y}`] = message.move.symbol;
				this.lastPlacedMove = { x: message.move.x, y: message.move.y };
				this.winningCells = message.winningCells;
				console.log("Game over! Winning cells:", this.winningCells);
				this.drawBoard();

				// Clear session when game ends
				this.clearSession();

				setTimeout(() => {
					this.showGameOverModal(message.winner);
				}, 500);
				break;

			case "gameReset":
				this.currentLobby = message.lobby;
				this.myPlayer = this.currentLobby.players.find((p) => p.id === this.myPlayerId);
				this.currentGame = null;
				this.board = {};
				this.winningCells = [];
				this.lastPlacedMove = null;
				this.highlightLastMove = false;
				this.showLobbyScreen();
				break;

			case "error":
				this.showNotification(message.message, "error");
				break;
		}
	}

	highlightLastMoveTemporarily() {
		// Clear any existing timeout
		if (this.highlightTimeout) {
			clearTimeout(this.highlightTimeout);
		}

		this.highlightLastMove = true;
		this.drawBoard();

		this.highlightTimeout = setTimeout(() => {
			this.highlightLastMove = false;
			this.drawBoard();
		}, 1000);
	}

	showLastMove() {
		if (this.lastPlacedMove) {
			// Clear any existing timeout
			if (this.highlightTimeout) {
				clearTimeout(this.highlightTimeout);
			}

			// Center view on last move
			const scaledCellSize = this.cellSize * this.scale;
			this.offsetX = this.canvas.width / 2 - (this.lastPlacedMove.x + 0.5) * scaledCellSize;
			this.offsetY = this.canvas.height / 2 - (this.lastPlacedMove.y + 0.5) * scaledCellSize;

			// Highlight for 2 seconds
			this.highlightLastMove = true;
			this.drawBoard();

			this.highlightTimeout = setTimeout(() => {
				this.highlightLastMove = false;
				this.drawBoard();
			}, 2000);
		}
	}

	showNotification(message, type = "info") {
		// Remove existing notifications
		const existing = document.querySelector(".notification");
		if (existing) {
			existing.remove();
		}

		const notification = document.createElement("div");
		notification.className = `notification notification-${type}`;
		notification.textContent = message;
		document.body.appendChild(notification);

		setTimeout(() => {
			notification.classList.add("show");
		}, 10);

		setTimeout(() => {
			notification.classList.remove("show");
			setTimeout(() => notification.remove(), 300);
		}, 3000);
	}

	createLobby() {
		const username = document.getElementById("usernameInput").value.trim();

		if (!username) {
			this.showNotification("Please enter your name", "error");
			return;
		}

		this.username = username;

		this.ws.send(
			JSON.stringify({
				type: "createLobby",
				username: username,
				winLength: 3,
				maxPlayers: 4,
			}),
		);
	}

	joinLobby() {
		const username = document.getElementById("usernameInput").value.trim();
		const lobbyId = document.getElementById("lobbyIdInput").value.trim().toUpperCase();
		const asSpectator = document.getElementById("joinAsSpectatorCheckbox").checked;

		if (!username) {
			this.showNotification("Please enter your name", "error");
			return;
		}

		if (!lobbyId) {
			this.showNotification("Please enter lobby ID", "error");
			return;
		}

		this.username = username;

		this.ws.send(
			JSON.stringify({
				type: "joinLobby",
				lobbyId: lobbyId,
				username: username,
				asSpectator: asSpectator,
			}),
		);
	}

	toggleSpectator() {
		this.ws.send(
			JSON.stringify({
				type: "toggleSpectator",
			}),
		);
	}

	copyLobbyId() {
		navigator.clipboard.writeText(this.lobbyId);
		const btn = document.getElementById("copyLobbyIdBtn");
		const originalText = btn.textContent;
		btn.textContent = "Copied!";
		setTimeout(() => {
			btn.textContent = originalText;
		}, 2000);
	}

	claimSymbol(symbol) {
		console.log("Claiming symbol:", symbol);
		this.ws.send(
			JSON.stringify({
				type: "claimSymbol",
				symbol: symbol,
			}),
		);
	}

	toggleReady() {
		console.log("Toggling ready state");
		if (!this.myPlayer) {
			this.myPlayer = this.currentLobby.players.find((p) => p.id === this.myPlayerId);
		}

		if (!this.myPlayer.symbol) {
			this.showNotification("Please select a symbol first", "error");
			return;
		}

		this.ws.send(
			JSON.stringify({
				type: "toggleReady",
			}),
		);
	}

	updateReadyButton() {
		const readyBtn = document.getElementById("readyBtn");
		if (this.myPlayer && this.myPlayer.ready) {
			readyBtn.textContent = "Unready";
			readyBtn.classList.add("ready");
		} else {
			readyBtn.textContent = "Ready";
			readyBtn.classList.remove("ready");
		}
	}

	updateStartButton() {
		if (this.isSpectator) return;

		const isLeader = this.currentLobby.leader === this.myPlayerId;
		const startBtn = document.getElementById("startGameBtn");

		if (!startBtn) return;

		if (isLeader) {
			const allReady = this.currentLobby.players.length >= 2 && this.currentLobby.players.every((p) => p.ready && p.symbol);
			startBtn.textContent = "Start Game";
			startBtn.disabled = !allReady;
		} else {
			startBtn.textContent = "Waiting for leader";
			startBtn.disabled = true;
		}
	}

	updateLeaderUI() {
		if (this.isSpectator) return;

		const isLeader = this.currentLobby.leader === this.myPlayerId;
		document.getElementById("updateSettingsBtn").style.display = isLeader ? "block" : "none";
		document.getElementById("winLengthInput").disabled = !isLeader;
		document.getElementById("maxPlayersInput").disabled = !isLeader;

		// Update start button text and state
		this.updateStartButton();
	}

	updateSettings() {
		const winLength = parseInt(document.getElementById("winLengthInput").value);
		const maxPlayers = parseInt(document.getElementById("maxPlayersInput").value);

		console.log("Updating settings - Win Length:", winLength, "Max Players:", maxPlayers);

		this.ws.send(
			JSON.stringify({
				type: "updateSettings",
				winLength: winLength,
				maxPlayers: maxPlayers,
			}),
		);
	}

	startGame() {
		this.ws.send(
			JSON.stringify({
				type: "startGame",
			}),
		);
	}

	leaveLobby() {
		this.clearSession();
		this.showScreen("homeScreen");
		this.lobbyId = null;
		this.currentLobby = null;
		this.myPlayerId = null;
		this.myPlayer = null;
		// Reconnect to get a new client ID
		if (this.ws) {
			this.ws.close();
		}
	}

	backToLobby() {
		document.getElementById("gameOverModal").classList.remove("active");

		// Reset game state
		this.board = {};
		this.winningCells = [];
		this.lastPlacedMove = null;
		this.highlightLastMove = false;
		this.currentGame = null;

		// Reset players ready state
		if (this.currentLobby) {
			this.currentLobby.players.forEach((p) => (p.ready = false));
			if (this.myPlayer) {
				this.myPlayer.ready = false;
			}
		}

		this.showLobbyScreen();
	}

	showScreen(screenId) {
		document.querySelectorAll(".screen").forEach((screen) => {
			screen.classList.remove("active");
		});
		document.getElementById(screenId).classList.add("active");

		// Show GitHub button only on home screen
		const githubBtn = document.querySelector(".github-corner");
		if (githubBtn) {
			if (screenId === "homeScreen") {
				githubBtn.style.display = "flex";
			} else {
				githubBtn.style.display = "none";
			}
		}
	}

	showLobbyScreen() {
		this.showScreen("lobbyScreen");
		document.getElementById("lobbyIdDisplay").textContent = this.lobbyId;

		// NEW: Update spectator button
		const toggleBtn = document.getElementById("toggleSpectatorBtn");
		const btnText = document.getElementById("spectatorBtnText");
		if (this.isSpectator) {
			btnText.textContent = "Become Player";
			toggleBtn.classList.add("spectator-mode");
		} else {
			btnText.textContent = "Become Spectator";
			toggleBtn.classList.remove("spectator-mode");
		}

		// NEW: Hide/show UI elements based on spectator status
		const symbolSection = document.getElementById("symbolSectionContainer");
		const readyBtn = document.getElementById("readyBtn");

		if (this.isSpectator) {
			symbolSection.style.display = "none";
			readyBtn.style.display = "none";
		} else {
			symbolSection.style.display = "block";
			readyBtn.style.display = "block";
			this.updateReadyButton();
		}

		const isLeader = !this.isSpectator && this.currentLobby.leader === this.myPlayerId;
		document.getElementById("updateSettingsBtn").style.display = isLeader ? "block" : "none";

		// Show start button for all non-spectator players
		const startBtn = document.getElementById("startGameBtn");
		if (!this.isSpectator) {
			startBtn.style.display = "block";
		} else {
			startBtn.style.display = "none";
		}

		document.getElementById("winLengthInput").disabled = !isLeader;
		document.getElementById("maxPlayersInput").disabled = !isLeader;

		this.updateSettingsDisplay();
		this.updatePlayersList();
		this.updateSpectatorsList(); // NEW

		if (!this.isSpectator) {
			this.updateSymbolSelection();
			this.updateStartButton();
		}
	}

	updateSettingsDisplay() {
		document.getElementById("winLengthInput").value = this.currentLobby.settings.winLength;
		document.getElementById("maxPlayersInput").value = this.currentLobby.settings.maxPlayers;
	}

	updateSymbolSelection() {
		const symbolSelection = document.getElementById("symbolSelection");
		symbolSelection.innerHTML = "";

		const usedSymbols = this.currentLobby.players.filter((p) => p.symbol).map((p) => p.symbol);

		const mySymbol = this.myPlayer ? this.myPlayer.symbol : null;

		this.availableSymbols.forEach((symbol) => {
			const btn = document.createElement("button");
			btn.className = "symbol-btn";
			btn.textContent = symbol;

			if (symbol === mySymbol) {
				btn.classList.add("selected");
			} else if (usedSymbols.includes(symbol)) {
				btn.classList.add("taken");
				btn.disabled = true;
			}

			btn.addEventListener("click", () => {
				console.log("Symbol button clicked:", symbol);
				if (!btn.disabled && !btn.classList.contains("taken")) {
					this.claimSymbol(symbol);
				}
			});

			symbolSelection.appendChild(btn);
		});
	}

	updatePlayersList() {
		const playersList = document.getElementById("playersList");
		playersList.innerHTML = "";

		this.currentLobby.players.forEach((player) => {
			const playerItem = document.createElement("div");
			playerItem.className = "player-item";

			if (player.ready) {
				playerItem.classList.add("ready");
			}

			const symbol = document.createElement("div");
			symbol.className = "player-symbol";
			symbol.textContent = player.symbol || "?";

			const name = document.createElement("div");
			name.className = "player-name";
			name.textContent = player.name;

			playerItem.appendChild(symbol);
			playerItem.appendChild(name);

			const badges = document.createElement("div");
			badges.className = "player-badges";

			if (player.id === this.currentLobby.leader) {
				const leaderBadge = document.createElement("div");
				leaderBadge.className = "player-badge leader";
				leaderBadge.textContent = "LEADER";
				badges.appendChild(leaderBadge);
			}

			if (player.ready) {
				const readyBadge = document.createElement("div");
				readyBadge.className = "player-badge ready";
				readyBadge.textContent = "READY";
				badges.appendChild(readyBadge);
			}

			playerItem.appendChild(badges);
			playersList.appendChild(playerItem);
		});
	}

	updateSpectatorsList() {
		const spectatorsSection = document.getElementById("spectatorsSection");
		const spectatorsList = document.getElementById("spectatorsList");

		if (this.currentLobby.spectators && this.currentLobby.spectators.length > 0) {
			spectatorsSection.style.display = "block";
			spectatorsList.innerHTML = "";

			this.currentLobby.spectators.forEach((spectator) => {
				const spectatorItem = document.createElement("div");
				spectatorItem.className = "spectator-item";

				const icon = document.createElement("div");
				icon.className = "spectator-icon";
				icon.textContent = "";

				const name = document.createElement("div");
				name.className = "spectator-name";
				name.textContent = spectator.name;

				spectatorItem.appendChild(icon);
				spectatorItem.appendChild(name);
				spectatorsList.appendChild(spectatorItem);
			});
		} else {
			spectatorsSection.style.display = "none";
		}
	}

	showGameScreen() {
		this.showScreen("gameScreen");

		// Show spectator badge if spectating
		const spectatorBadge = document.getElementById("spectatorBadge");
		if (this.isSpectator) {
			spectatorBadge.style.display = "block";
		} else {
			spectatorBadge.style.display = "none";
		}

		this.initCanvas();
		this.updateGamePlayersList();
		this.updateTurnInfo();
		this.resetView();
	}

	removeCanvasEventListeners() {
		if (!this.canvas) return;

		// Remove all event listeners if they exist
		if (this.canvasHandlers.mousedown) {
			this.canvas.removeEventListener("mousedown", this.canvasHandlers.mousedown);
		}
		if (this.canvasHandlers.mousemove) {
			this.canvas.removeEventListener("mousemove", this.canvasHandlers.mousemove);
		}
		if (this.canvasHandlers.mouseup) {
			this.canvas.removeEventListener("mouseup", this.canvasHandlers.mouseup);
		}
		if (this.canvasHandlers.mouseleave) {
			this.canvas.removeEventListener("mouseleave", this.canvasHandlers.mouseleave);
		}
		if (this.canvasHandlers.contextmenu) {
			this.canvas.removeEventListener("contextmenu", this.canvasHandlers.contextmenu);
		}
		if (this.canvasHandlers.touchstart) {
			this.canvas.removeEventListener("touchstart", this.canvasHandlers.touchstart);
		}
		if (this.canvasHandlers.touchmove) {
			this.canvas.removeEventListener("touchmove", this.canvasHandlers.touchmove);
		}
		if (this.canvasHandlers.touchend) {
			this.canvas.removeEventListener("touchend", this.canvasHandlers.touchend);
		}
		if (this.canvasHandlers.wheel) {
			this.canvas.removeEventListener("wheel", this.canvasHandlers.wheel);
		}
	}

	initCanvas() {
		this.canvas = document.getElementById("gridCanvas");
		this.ctx = this.canvas.getContext("2d");

		const gameBoard = document.getElementById("gameBoard");
		this.canvas.width = gameBoard.clientWidth;
		this.canvas.height = gameBoard.clientHeight;

		// Remove existing listeners
		this.removeCanvasEventListeners();

		// Create handler functions
		this.canvasHandlers.mousedown = (e) => this.handleMouseDown(e);
		this.canvasHandlers.mousemove = (e) => this.handleMouseMove(e);
		this.canvasHandlers.mouseup = (e) => this.handleMouseUp(e);
		this.canvasHandlers.mouseleave = () => this.handleMouseLeave();
		this.canvasHandlers.contextmenu = (e) => {
			e.preventDefault();
			return false;
		};
		this.canvasHandlers.touchstart = (e) => this.handleTouchStart(e);
		this.canvasHandlers.touchmove = (e) => this.handleTouchMove(e);
		this.canvasHandlers.touchend = (e) => this.handleTouchEnd(e);

		// Add event listeners
		this.canvas.addEventListener("mousedown", this.canvasHandlers.mousedown);
		this.canvas.addEventListener("mousemove", this.canvasHandlers.mousemove);
		this.canvas.addEventListener("mouseup", this.canvasHandlers.mouseup);
		this.canvas.addEventListener("mouseleave", this.canvasHandlers.mouseleave);
		this.canvas.addEventListener("contextmenu", this.canvasHandlers.contextmenu);
		this.canvas.addEventListener("touchstart", this.canvasHandlers.touchstart, { passive: false });
		this.canvas.addEventListener("touchmove", this.canvasHandlers.touchmove, { passive: false });
		this.canvas.addEventListener("touchend", this.canvasHandlers.touchend, { passive: false });

		// Mouse wheel zoom handler
		this.canvasHandlers.wheel = (e) => this.handleMouseWheel(e);
		this.canvas.addEventListener("wheel", this.canvasHandlers.wheel, { passive: false });

		// Window resize handler (only add once)
		if (!this.resizeHandler) {
			this.resizeHandler = () => {
				if (this.canvas && this.ctx) {
					const gameBoard = document.getElementById("gameBoard");
					this.canvas.width = gameBoard.clientWidth;
					this.canvas.height = gameBoard.clientHeight;
					this.drawBoard();
				}
			};
			window.addEventListener("resize", this.resizeHandler);
		}

		this.drawBoard();
	}

	handleMouseDown(e) {
		this.isRightClick = e.button === 2;
		this.isDragging = true;
		this.dragMoved = false;
		this.dragStartTime = Date.now();
		this.lastMouseX = e.clientX;
		this.lastMouseY = e.clientY;
	}

	handleMouseMove(e) {
		if (this.isDragging) {
			const dx = e.clientX - this.lastMouseX;
			const dy = e.clientY - this.lastMouseY;

			if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
				this.dragMoved = true;
			}

			// Allow panning with right click or when dragging
			if (this.isRightClick || this.dragMoved) {
				this.offsetX += dx;
				this.offsetY += dy;
				this.lastMouseX = e.clientX;
				this.lastMouseY = e.clientY;
				this.drawBoard();
			}
		}
	}

	handleMouseUp(e) {
		const timeSinceDragStart = Date.now() - this.dragStartTime;

		// Only register as click if it was left button, quick, and didn't move
		if (!this.isRightClick && !this.dragMoved && timeSinceDragStart < 200 && e) {
			this.handleClick(e);
		}

		this.isDragging = false;
		this.dragMoved = false;
		this.isRightClick = false;
	}

	handleMouseLeave() {
		this.isDragging = false;
		this.dragMoved = false;
		this.isRightClick = false;
	}

	handleMouseWheel(e) {
		e.preventDefault();
		const rect = this.canvas.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		// Calculate world coordinates before zoom
		const worldX = (mouseX - this.offsetX) / this.scale;
		const worldY = (mouseY - this.offsetY) / this.scale;

		// Zoom factor based on wheel direction
		const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
		const newScale = Math.max(0.5, Math.min(3, this.scale * zoomFactor));

		// Calculate new offsets to zoom toward mouse position
		this.offsetX = mouseX - worldX * newScale;
		this.offsetY = mouseY - worldY * newScale;
		this.scale = newScale;

		this.drawBoard();
	}

	handleTouchStart(e) {
		e.preventDefault();
		const touch = e.touches[0];
		this.isDragging = true;
		this.dragMoved = false;
		this.dragStartTime = Date.now();
		this.lastMouseX = touch.clientX;
		this.lastMouseY = touch.clientY;
	}

	handleTouchMove(e) {
		e.preventDefault();
		if (this.isDragging && e.touches.length === 1) {
			const touch = e.touches[0];
			const dx = touch.clientX - this.lastMouseX;
			const dy = touch.clientY - this.lastMouseY;

			if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
				this.dragMoved = true;
			}

			this.offsetX += dx;
			this.offsetY += dy;

			this.lastMouseX = touch.clientX;
			this.lastMouseY = touch.clientY;

			this.drawBoard();
		}
	}

	handleTouchEnd(e) {
		const timeSinceDragStart = Date.now() - this.dragStartTime;

		// If it was a quick tap and didn't move much, treat as click
		if (!this.dragMoved && timeSinceDragStart < 200 && e.changedTouches.length > 0) {
			const touch = e.changedTouches[0];
			const fakeEvent = {
				clientX: touch.clientX,
				clientY: touch.clientY,
			};
			this.handleClick(fakeEvent);
		}

		this.isDragging = false;
		this.dragMoved = false;
	}

	handleClick(e) {
		if (!this.currentGame) {
			return;
		}

		if (this.isSpectator) {
			this.showNotification("You are spectating and cannot make moves", "info");
			return;
		}

		// Check if it's the player's turn BEFORE trying to make a move
		if (this.currentGame.currentPlayer !== this.myPlayerId) {
			// Only show notification when user actively tries to click during opponent's turn
			this.showNotification("Not your turn! Wait for your turn.", "error");
			return;
		}

		const rect = this.canvas.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		const x = Math.floor((mouseX - this.offsetX) / (this.cellSize * this.scale));
		const y = Math.floor((mouseY - this.offsetY) / (this.cellSize * this.scale));

		// Check if cell is already occupied
		const key = `${x},${y}`;
		if (this.board[key]) {
			this.showNotification("Cell already taken!", "error");
			return;
		}

		console.log("Making move at:", x, y);

		this.ws.send(
			JSON.stringify({
				type: "makeMove",
				x: x,
				y: y,
			}),
		);
	}

	zoom(factor) {
		this.scale *= factor;
		this.scale = Math.max(0.5, Math.min(3, this.scale));
		this.drawBoard();
	}

	resetView() {
		this.offsetX = this.canvas.width / 2;
		this.offsetY = this.canvas.height / 2;
		this.scale = 1;
		this.drawBoard();
	}

	drawBoard() {
		if (!this.ctx || !this.canvas) return;

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		const scaledCellSize = this.cellSize * this.scale;

		// Calculate visible range
		const startX = Math.floor(-this.offsetX / scaledCellSize) - 2;
		const startY = Math.floor(-this.offsetY / scaledCellSize) - 2;
		const endX = Math.ceil((this.canvas.width - this.offsetX) / scaledCellSize) + 2;
		const endY = Math.ceil((this.canvas.height - this.offsetY) / scaledCellSize) + 2;

		// Draw grid
		this.ctx.strokeStyle = "#ddd";
		this.ctx.lineWidth = 1;

		for (let x = startX; x <= endX; x++) {
			const screenX = this.offsetX + x * scaledCellSize;
			this.ctx.beginPath();
			this.ctx.moveTo(screenX, 0);
			this.ctx.lineTo(screenX, this.canvas.height);
			this.ctx.stroke();
		}

		for (let y = startY; y <= endY; y++) {
			const screenY = this.offsetY + y * scaledCellSize;
			this.ctx.beginPath();
			this.ctx.moveTo(0, screenY);
			this.ctx.lineTo(this.canvas.width, screenY);
			this.ctx.stroke();
		}

		// Draw origin
		this.ctx.strokeStyle = "#667eea";
		this.ctx.lineWidth = 3;
		this.ctx.beginPath();
		this.ctx.moveTo(this.offsetX, 0);
		this.ctx.lineTo(this.offsetX, this.canvas.height);
		this.ctx.stroke();
		this.ctx.beginPath();
		this.ctx.moveTo(0, this.offsetY);
		this.ctx.lineTo(this.canvas.width, this.offsetY);
		this.ctx.stroke();

		// Draw symbols
		this.ctx.font = `bold ${scaledCellSize * 0.6}px Arial`;
		this.ctx.textAlign = "center";
		this.ctx.textBaseline = "middle";

		for (let key in this.board) {
			const [x, y] = key.split(",").map(Number);
			const screenX = this.offsetX + (x + 0.5) * scaledCellSize;
			const screenY = this.offsetY + (y + 0.5) * scaledCellSize;

			const isWinning = this.winningCells.some((cell) => cell[0] === x && cell[1] === y);
			const isLastMove = this.highlightLastMove && this.lastPlacedMove && this.lastPlacedMove.x === x && this.lastPlacedMove.y === y;

			// Draw highlight backgrounds
			if (isWinning) {
				this.ctx.fillStyle = "#ffd700";
				this.ctx.fillRect(this.offsetX + x * scaledCellSize + 1, this.offsetY + y * scaledCellSize + 1, scaledCellSize - 2, scaledCellSize - 2);
			} else if (isLastMove) {
				this.ctx.fillStyle = "#b3d9ff";
				this.ctx.fillRect(this.offsetX + x * scaledCellSize + 1, this.offsetY + y * scaledCellSize + 1, scaledCellSize - 2, scaledCellSize - 2);
			}

			this.ctx.fillStyle = isWinning ? "#ff0000" : "#333";
			this.ctx.fillText(this.board[key], screenX, screenY);
		}
	}

	updateGamePlayersList() {
		const list = document.getElementById("gamePlayersList");
		list.innerHTML = "";

		// Use playerOrder if available, otherwise use players array
		const orderedPlayers = this.currentGame.playerOrder
			? this.currentGame.playerOrder.map((id) => this.currentGame.players.find((p) => p.id === id)).filter((p) => p)
			: this.currentGame.players;

		orderedPlayers.forEach((player) => {
			const item = document.createElement("div");
			item.className = "game-player-item";
			if (player.id === this.currentGame.currentPlayer) {
				item.classList.add("active");
			}

			const symbol = document.createElement("div");
			symbol.className = "game-player-symbol";
			symbol.textContent = player.symbol;

			const name = document.createElement("div");
			name.className = "game-player-name";
			name.textContent = player.name;

			item.appendChild(symbol);
			item.appendChild(name);
			list.appendChild(item);
		});
	}

	updateTurnInfo() {
		const turnInfo = document.getElementById("turnInfo");

		if (this.isSpectator) {
			const currentPlayer = this.currentGame.players.find((p) => p.id === this.currentGame.currentPlayer);
			turnInfo.textContent = `${currentPlayer.name}'s turn (${this.currentGame.currentSymbol}) - ${this.winLength} in a row to win`;
			turnInfo.style.color = "#fff";
		} else {
			const currentPlayer = this.currentGame.players.find((p) => p.id === this.currentGame.currentPlayer);

			if (this.currentGame.currentPlayer === this.myPlayerId) {
				turnInfo.textContent = `Your turn! (${this.currentGame.currentSymbol}) - ${this.winLength} in a row to win`;
				turnInfo.style.color = "#4caf50";
			} else {
				turnInfo.textContent = `${currentPlayer.name}'s turn (${this.currentGame.currentSymbol}) - ${this.winLength} in a row to win`;
				turnInfo.style.color = "#fff";
			}
		}

		this.updateGamePlayersList();
	}

	showGameOverModal(winner) {
		const modal = document.getElementById("gameOverModal");
		const winnerText = document.getElementById("winnerText");

		if (winner.id === this.myPlayerId) {
			winnerText.textContent = `You Win!`;
		} else {
			winnerText.textContent = `${winner.name} (${winner.symbol}) Wins!`;
		}

		modal.classList.add("active");
	}
}

// Initialize the game when page loads
document.addEventListener("DOMContentLoaded", () => {
	new HyperToe();
});
