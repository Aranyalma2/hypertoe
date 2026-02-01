# HyperToe

A real-time multiplayer infinite Tic Tac Toe game built with Node.js, WebSocket, and vanilla JavaScript.

## Features

- **Infinite Grid**: Play on an unlimited board
- **2-4 Players**: Support for multiple players
- **Real-time**: WebSocket-powered instant synchronization
- **Lobby System**: Create and join game lobbies
- **Configurable**: Adjust win length (3, 4, 5+ in a row)
- **Anonymous Play**: No login required, just enter your name
- **Responsive**: Works on desktop and mobile

## Where to Play

Check the game on https://hypertoe.onrender.com/

## Installation

### Standard Installation

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

3. Open your browser and navigate to:

```
http://localhost:3000
```

### Docker Installation

1. Build and run with Docker:

```bash
docker build -t hypertoe .
docker run -p 3000:3000 hypertoe
```

2. Or use Docker Compose:

```bash
docker-compose up
```

3. Open your browser and navigate to:

```
http://localhost:3000
```

## How to Play

1. **Enter Your Name**: Type your username on the home screen
2. **Create or Join Lobby**:
    - Create a new lobby and share the lobby ID with friends
    - Or join an existing lobby using the lobby ID
3. **Configure Settings**: The lobby leader can adjust:
    - Win length (how many in a row needed to win)
    - Maximum number of players
4. **Start Game**: Once ready, the lobby leader starts the game
5. **Play**: Click on the grid to place your symbol
    - Pan the board by clicking and dragging
    - Use zoom controls to adjust view
6. **Win**: Get the required number of symbols in a row (horizontal, vertical, or diagonal)

## Controls

- **Click/Tap**: Place symbol on the grid
- **Drag**: Pan around the infinite board
- **Mouse wheel**: Zoom in and out
- **Center**: Reset view to origin

## Technical Stack

- **Backend**: Node.js + ws (WebSocket library)
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Communication**: WebSocket for real-time bidirectional communication

## License

MIT License - See LICENSE file for details
