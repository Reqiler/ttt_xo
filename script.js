const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const popup = document.getElementById('popup');
const popupMessage = document.getElementById('popupMessage');
const p1inv = document.getElementById('player1inv');
const p2inv = document.getElementById('player2inv');

const teamAStatusDot = document.getElementById('teamAStatus');
const teamBStatusDot = document.getElementById('teamBStatus');

const SIZE_LEVEL = { small: 1, medium: 2, large: 3 };
const PIECE_TYPES = ['small', 'medium', 'large'];

const ipv4 = "";
const socket = new WebSocket("ws://project-ttt-x0.onrender.com");

let board, currentPlayer, currentSize, playerPieces, winningPattern = [];

// ฟังก์ชันเปลี่ยนเลข player เป็น Team A / B
function teamName(player) {
    return player === 1 ? 'Team A' : 'Team B';
}

function resetGameClient() {
    board = Array(9).fill().map(() => []);
    currentPlayer = 1;
    currentSize = 'small';
    winningPattern = [];
    playerPieces = {
        1: { small: 2, medium: 2, large: 2 },
        2: { small: 2, medium: 2, large: 2 }
    };
    document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
    setSize(currentSize);
    statusEl.textContent = `🎮 ถึงตา ${teamName(currentPlayer)}`;
    renderBoard();
    hidePopup();
    hideHowToPlay();
    setOnlineStatus(true, true);
}

function setSize(size) {
    currentSize = size;
    document.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.querySelector(`.size-btn[onclick*="${size}"]`);
    if (btn) btn.classList.add('active');
    updateButtons();
}

function renderBoard() {
    boardEl.innerHTML = '';
    board.forEach((stack, i) => {
        const cell = document.createElement('div');
        cell.className = 'cell';

        if (!winningPattern.length) {
            cell.onclick = () => handlePlace(i);
            cell.style.cursor = 'pointer';
        } else {
            cell.onclick = null;
            cell.style.cursor = 'default';
        }

        if (winningPattern.includes(i)) {
            cell.classList.add('win-cell');
            const winColor = currentPlayer === 1 ?
                'linear-gradient(145deg, #dc2626, #b91c1c)' :
                'linear-gradient(145deg, #2563eb, #1d4ed8)';
            const winGlow = currentPlayer === 1 ?
                'rgba(220, 38, 38, 0.6)' :
                'rgba(37, 99, 235, 0.6)';
            cell.style.setProperty('--win-color', winColor);
            cell.style.setProperty('--win-glow', winGlow);
            cell.style.animationDelay = `${winningPattern.indexOf(i) * 0.2}s`;
        }

        const top = stack[stack.length - 1];
        if (top) {
            const piece = document.createElement('div');
            piece.className = `piece player${top.player} ${top.size}`;
            if (winningPattern.includes(i)) piece.classList.add('winning');

            const face = document.createElement('div');
            face.className = 'face';
            face.innerHTML = '👀';
            piece.appendChild(face);

            cell.appendChild(piece);
        }

        boardEl.appendChild(cell);
    });

    updateInventory();
    updateButtons();
}

function updateInventory() {
    const p1 = playerPieces[1];
    const p2 = playerPieces[2];
    p1inv.innerHTML = `<b>Team A (แดง)</b><br/>🥚: ${p1.small} | 🍳: ${p1.medium} | 🐣: ${p1.large}`;
    p2inv.innerHTML = `<b>Team B (น้ำเงิน)</b><br/>🥚: ${p2.small} | 🍳: ${p2.medium} | 🐣: ${p2.large}`;
}

function updateButtons() {
    PIECE_TYPES.forEach(size => {
        const btn = document.querySelector(`.size-btn[onclick*="${size}"]`);
        btn.disabled = playerPieces[currentPlayer][size] <= 0;
    });
}

function handlePlace(index) {
    const stack = board[index];
    const top = stack[stack.length - 1];

    if (!hasSelectedTeam) {
        showPopup("กรุณาเลือกทีมก่อนเล่น");
        return;
    }
    socket.send(JSON.stringify({
        action: "placePiece",
        index: index,
        size: currentSize
    }));
}

function checkWin(player) {
    const wins = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (let pattern of wins) {
        const isWin = pattern.every(i =>
            board[i].length &&
            board[i][board[i].length - 1].player === player
        );
        if (isWin) {
            winningPattern = pattern;
            return true;
        }
    }
    return false;
}

function showHowToPlay() {
    document.getElementById('howToPlay').style.display = 'flex';
}

function hideHowToPlay() {
    document.getElementById('howToPlay').style.display = 'none';
}

socket.addEventListener("open", () => {
    document.getElementById("connectionDot").classList.add("online");
    document.getElementById("connectionLabel").textContent = "เชื่อมต่อแล้ว";
    resetGame();
});

socket.addEventListener("close", () => {
    document.getElementById("connectionDot").classList.remove("online");
    document.getElementById("connectionDot").classList.add("offline");
    document.getElementById("connectionLabel").textContent = "เชื่อมต่อไม่สำเร็จ!!!";
});

socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    statusEl.textContent = data.statusText;

    // ใส่คลาสสีสถานะ
    statusEl.classList.remove("team-a", "team-b");
    statusEl.classList.add(data.currentPlayer === 1 ? "team-a" : "team-b");

    if (data.type === "users") {
        
        console.log("อัปเดตผู้เล่น:", data);  // 👈 เพิ่มบรรทัดนี้

        document.getElementById("totalOnline").textContent = data.count;
        document.getElementById("teamAOnlineCount").textContent = data.teamA;
        document.getElementById("teamBOnlineCount").textContent = data.teamB;
    }

    if (data.type === "gameState") {

        if (data.reset) {
            resetGameClient();  // หรือทำอัพเดตตัวแปรทั้งหมดตาม data
        }

        board = data.board;
        currentPlayer = data.currentPlayer;
        playerPieces = data.playerPieces;
        winningPattern = data.winningPattern || [];

        statusEl.textContent = data.statusText;
        renderBoard();

        if (data.gameOver) {
            showPopup(data.statusText);
            disableBoard(); // ปิดการคลิกบนบอร์ด
        } else {
            hidePopup(); // ซ่อน popup ถ้ายังไม่จบเกม
        }
    }
});

function resetGame() {
    socket.send(JSON.stringify({ action: "resetGame" }));
}

function showPopup(message) {
    popupMessage.textContent = message;
    popup.style.display = 'flex';
}

function hidePopup() {
    popup.style.display = 'none';
}

function disableBoard() {
    document.querySelectorAll('.cell').forEach(cell => cell.onclick = null);
}

let hasSelectedTeam = false;  // ตัวแปรสถานะ เลือกทีมแล้วหรือยัง

function selectTeam(team) {
    if (hasSelectedTeam) return; // เลือกทีมแล้ว ห้ามเปลี่ยน

    // เปลี่ยนปุ่มให้แสดงว่าเลือกแล้ว
    document.querySelectorAll(".team-btn").forEach(btn => btn.classList.remove("selected"));
    document.querySelector(`.team-btn.team-${team.toLowerCase()}`).classList.add("selected");

    document.getElementById("selectedTeam").textContent = `เลือกทีม: ${team === "A" ? "🅰️ ทีม A" : "🅱️ ทีม B"}`;

    hasSelectedTeam = true;  // ตั้งสถานะว่าเลือกแล้ว

    socket.send(JSON.stringify({
        action: "selectTeam",
        team: team
    }));
}
