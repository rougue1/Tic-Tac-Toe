export interface User {
    id: number;
    username: string;
    wins: number;
}

export interface AuthResponse {
    access_token: string;
    user_id: number;
    username: string;
}

export interface Game {
    id: number;
    room_id: string;
    player_x_id: number | null;
    player_x_username?: string | null;
    player_o_id: number | null;
    player_o_username?: string | null;
    board: string[]; // Array of 'X', 'O', or ' '
    current_turn_player_id: number | null;
    current_turn_username?: string | null;
    current_player_symbol?: "X" | "O" | null; // Symbol for the viewing user
    status: "pending" | "active" | "finished_x_wins" | "finished_o_wins" | "draw";
    is_public: boolean;
    winner_id: number | null;
    winner_username?: string | null;
    created_at: string;
}

export interface ScoreboardEntry {
    username: string;
    wins: number;
}

export interface Friend {
    id: number;
    username: string;
    online: boolean;
}

export interface FriendRequest {
    request_id: number;
    requester_id: number;
    requester_username: string;
}

export interface SearchedUser {
    id: number;
    username: string;
}

// For Socket.IO events (add more as needed)
export interface GameUpdatePayload extends Game {}

export interface PlayerJoinedPayload {
    game: Game;
    joining_player_username: string;
}

export interface GameOverPayload {
    game: Game;
    winner?: "X" | "O";
    draw?: boolean;
}

export interface FriendStatusUpdatePayload {
    user_id: number;
    username: string;
    online: boolean;
}

export interface FriendRequestReceivedPayload extends FriendRequest {}

export interface FriendRequestRespondedPayload {
    request_id: number;
    addressee_id: number;
    addressee_username: string;
    status: "accepted" | "declined";
}

export interface AvailablePlayer {
    id: number;
    username: string;
}
