import React from "react";
import { useNavigate } from "react-router-dom";
import Board from "../components/Game/Board";
import { useGameState } from "../hooks/useGameState"; // Import the custom hook
import styles from "./GamePage.module.css";

const GamePage: React.FC = () => {
    const navigate = useNavigate();
    const {
        game,
        loading,
        error,
        handleCellClick,
        isMyTurn,
        // playerSymbol, // Not directly used in render here, but available
        statusMessage,
    } = useGameState(); // Use the hook

    if (loading) return <div className={styles.centerStatus}>Loading game...</div>;
    if (error)
        return (
            <div className={`${styles.centerStatus} ${styles.error}`}>
                {error} <button onClick={() => navigate("/")}>Go Home</button>
            </div>
        );
    if (!game)
        return (
            <div className={styles.centerStatus}>
                Game not found. <button onClick={() => navigate("/")}>Go Home</button>
            </div>
        );

    return (
        <div className={styles.gamePage}>
            <h2>Tic-Tac-Toe: Room {game.room_id}</h2>
            <div className={styles.gameInfo}>
                <p>Player X: {game.player_x_username || (game.status === "pending" ? "Waiting..." : "N/A")}</p>
                <p>Player O: {game.player_o_username || (game.status === "pending" && game.player_x_id ? "Waiting..." : "N/A")}</p>
            </div>
            <p className={styles.statusMessage}>{statusMessage}</p>
            <Board board={game.board} onCellClick={handleCellClick} disabled={game.status !== "active" || !isMyTurn} />
            {game.status !== "active" && game.status !== "pending" && (
                <button onClick={() => navigate("/")} className={styles.homeButton}>
                    Back to Home
                </button>
            )}
        </div>
    );
};

export default GamePage;
