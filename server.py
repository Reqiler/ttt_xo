import asyncio
import websockets
import json
from collections import defaultdict

PORT = 6789

# เก็บข้อมูลผู้เล่นเชื่อมต่อ
connected_users = set()
user_teams = dict()  # websocket -> "A" or "B"

# สถานะเกม
board = [[] for _ in range(9)]
player_turn = 1
player_pieces = {
    1: {"small": 2, "medium": 2, "large": 2},
    2: {"small": 2, "medium": 2, "large": 2}
}
winning_pattern = []
game_over = False

# Mapping ทีม A/B เป็น player 1/2
team_to_player = {"A": 1, "B": 2}

# ส่งข้อมูลจำนวนผู้เล่นออนไลน์ให้ทุกคน
async def broadcast_user_counts():
    team_counts = {"A": 0, "B": 0}
    for t in user_teams.values():
        if t in team_counts:
            team_counts[t] += 1

    message = json.dumps({
        "type": "users",
        "count": len(connected_users),
        "teamA": team_counts["A"],
        "teamB": team_counts["B"]
    })

    await asyncio.gather(*[u.send(message) for u in connected_users])


# ส่งสถานะเกมให้ทุกคน
async def broadcast_game_state(reset=False):
    global board, player_turn, player_pieces, winning_pattern, game_over

    status_text = f"🎮 ถึงตา {'Team A' if player_turn == 1 else 'Team B'}"
    if game_over and winning_pattern:
        status_text = f"🏆 {'Team A' if player_turn == 1 else 'Team B'} ชนะ!"

    message = json.dumps({
        "type": "gameState",
        "board": board,
        "currentPlayer": player_turn,
        "playerPieces": player_pieces,
        "winningPattern": winning_pattern,
        "gameOver": game_over,
        "statusText": status_text,
        "reset": reset
    })

    await asyncio.gather(*[u.send(message) for u in connected_users])


# ตรวจสอบว่า player ชนะหรือไม่
def check_win(player):
    global winning_pattern
    wins = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ]

    for pattern in wins:
        if all(
            board[i] and board[i][-1]["player"] == player
            for i in pattern
        ):
            winning_pattern = pattern
            return True
    return False


# reset เกม
def reset_game():
    global board, player_turn, player_pieces, winning_pattern, game_over
    board = [[] for _ in range(9)]
    player_turn = 1
    player_pieces = {
        1: {"small": 2, "medium": 2, "large": 2},
        2: {"small": 2, "medium": 2, "large": 2}
    }
    winning_pattern = []
    game_over = False


# จัดการการเชื่อมต่อแต่ละ client
async def handler(websocket):
    global game_over, player_turn

    connected_users.add(websocket)
    await broadcast_user_counts()
    await broadcast_game_state()

    try:
        async for message in websocket:
            data = json.loads(message)

            if data["action"] == "selectTeam":
                team = data.get("team")
                if team in ["A", "B"]:
                    user_teams[websocket] = team
                    await broadcast_user_counts()
                    await broadcast_game_state()

            elif data["action"] == "resetGame":
                reset_game()
                await broadcast_game_state(reset=True)

            elif data["action"] == "placePiece":
                if game_over:
                    continue

                index = data.get("index")
                size = data.get("size")

                if websocket not in user_teams:
                    continue

                team = user_teams[websocket]
                player = team_to_player.get(team)

                if player != player_turn:
                    continue  # ไม่ใช่ตาตัวเอง

                if size not in ["small", "medium", "large"]:
                    continue

                if player_pieces[player][size] <= 0:
                    continue  # ไม่มีหมากขนาดนี้แล้ว

                # ตรวจสอบ stack ปัจจุบัน
                stack = board[index]
                if stack and SIZE_LEVEL(stack[-1]["size"]) >= SIZE_LEVEL(size):
                    continue  # ไม่สามารถครอบได้

                # วางหมาก
                board[index].append({
                    "player": player,
                    "size": size
                })

                player_pieces[player][size] -= 1

                # ตรวจสอบว่าชนะหรือยัง
                if check_win(player):
                    game_over = True

                else:
                    player_turn = 2 if player_turn == 1 else 1

                await broadcast_game_state()

    finally:
        connected_users.discard(websocket)
        user_teams.pop(websocket, None)
        await broadcast_user_counts()


# Helper: เปลี่ยนชื่อขนาดเป็นระดับตัวเลข
def SIZE_LEVEL(size):
    return {"small": 1, "medium": 2, "large": 3}.get(size, 0)


# เริ่ม WebSocket Server
async def main():
    print(f"Server started at ws://localhost:{PORT}")
    async with websockets.serve(handler, "0.0.0.0", PORT):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
