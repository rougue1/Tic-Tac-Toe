/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import { Game, GameUpdatePayload, GameOverPayload } from "../types";
import { getGameDetailsApi } from "../services/api";

interface UseGameStateReturn {
    game: Game | null;
    loading: boolean;
    error: string | null;
    message: string;
    handleCellClick: (index: number) => void;
    isMyTurn: boolean;
    playerSymbol: "X" | "O" | null;
    statusMessage: string;
}

export const useGameState = (): UseGameStateReturn => {
    const { roomId } = useParams<{ roomId: string }>();
    const { socket, isConnected } = useSocket();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [game, setGame] = useState<Game | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [message, setMessage] = useState<string>(""); // For win/draw/error messages

    const fetchGame = useCallback(async () => {
        if (!roomId) {
            setError("No room ID provided.");
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const response = await getGameDetailsApi(roomId);
            setGame(response.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.msg || "Failed to fetch game details.");
            setGame(null);
        } finally {
            setLoading(false);
        }
    }, [roomId]);

    useEffect(() => {
        fetchGame();
    }, [fetchGame]);

    useEffect(() => {
        if (!socket || !isConnected || !roomId || !user) return;

        console.log(`useGameState: Emitting join_game_room for ${roomId}`);
        socket.emit("join_game_room", { room_id: roomId });

        const handleGameUpdate = (updatedGame: GameUpdatePayload) => {
            if (updatedGame.room_id === roomId) {
                setGame(updatedGame);
                setMessage(""); // Clear previous messages on update
            }
        };

        const handleGameOver = (data: GameOverPayload) => {
            if (data.game.room_id === roomId) {
                setGame(data.game);
                if (data.winner) {
                    const winnerUsername = data.winner === "X" ? data.game.player_x_username : data.game.player_o_username;
                    setMessage(`${winnerUsername} (${data.winner}) wins!`);
                } else if (data.draw) {
                    setMessage("It's a draw!");
                }
            }
        };

        const handleGameJoinedSuccessfully = (data: { game: Game }) => {
            if (data.game.room_id === roomId) {
                setGame(data.game);
            }
        };

        const handleSocketError = (err: { message: string }) => {
            console.error("Socket error in useGameState:", err.message);
            // setError(err.message); // Can be too aggressive for generic errors
            setMessage(`Error: ${err.message}`);
        };

        socket.on("game_update", handleGameUpdate);
        socket.on("game_over", handleGameOver);
        socket.on("game_joined_successfully", handleGameJoinedSuccessfully);
        socket.on("error", handleSocketError);

        return () => {
            console.log(`useGameState: Emitting leave_game_room for ${roomId}`);
            socket.emit("leave_game_room", { room_id: roomId });
            socket.off("game_update", handleGameUpdate);
            socket.off("game_over", handleGameOver);
            socket.off("game_joined_successfully", handleGameJoinedSuccessfully);
            socket.off("error", handleSocketError);
        };
    }, [socket, isConnected, roomId, user, fetchGame]);

    const handleCellClick = (index: number) => {
        if (!socket || !game || !roomId || !user) return;
        if (game.status !== "active" || game.current_turn_player_id !== user.id) {
            return;
        }
        if (game.board[index] !== " ") {
            return;
        }
        socket.emit("make_move", { room_id: roomId, index });
    };

    const isMyTurn = game?.current_turn_player_id === user?.id;
    const playerSymbol = user?.id === game?.player_x_id ? "X" : user?.id === game?.player_o_id ? "O" : null;

    let statusMessage = "";
    if (game) {
        if (game.status === "pending") {
            statusMessage = `Room: ${game.room_id}. Waiting for ${game.player_x_id && !game.player_o_id ? "Player O" : "a player"} to join... You are ${playerSymbol || "Spectator"}.`;
            if (game.player_x_id && !game.player_o_id && !game.is_public) {
                statusMessage += ` Share room code: ${game.room_id}`;
            }
        } else if (game.status === "active") {
            statusMessage = isMyTurn ? "Your turn" : `Waiting for ${game.current_turn_username || "opponent"}'s turn`;
            statusMessage += `. You are Player ${playerSymbol}.`;
        } else if (game.status.startsWith("finished") || game.status === "draw") {
            if (game.winner_id === user?.id) statusMessage = "You won!";
            else if (game.winner_id) statusMessage = `${game.winner_username} won!`;
            else if (game.status === "draw") statusMessage = "It's a draw!";
            else statusMessage = `Game Over: ${game.status.replace("finished_", "").replace("_wins", " wins")}`;
        }
    }
    // If a direct message (from win/loss socket event) is set, it takes precedence
    const finalStatusMessage = message || statusMessage;

    return { game, loading, error, message: finalStatusMessage, handleCellClick, isMyTurn, playerSymbol, statusMessage: finalStatusMessage };
};
