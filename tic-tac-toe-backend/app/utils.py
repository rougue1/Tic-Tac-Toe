import shortuuid

def generate_room_code():
    """Generates a short, unique room code."""
    return shortuuid.uuid()[:6].upper() # e.g., "A3B7K1"

def check_win(board_str):
    """
    Checks for a win condition on the board.
    Board is a string of 9 chars.
    Returns 'X', 'O', or None.
    """
    board = list(board_str) # Convert string to list for easier indexing
    lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],  # Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8],  # Columns
        [0, 4, 8], [2, 4, 6]             # Diagonals
    ]
    for line in lines:
        a, b, c = line
        if board[a] != ' ' and board[a] == board[b] == board[c]:
            return board[a]  # Winner (X or O)
    return None

def check_draw(board_str):
    """Checks if the game is a draw."""
    return ' ' not in board_str and check_win(board_str) is None