import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import { fetchAvailablePlayersApi, setReadyToPlayApi, setUnreadyToPlayApi, startGameWithPlayerApi } from "../services/api";
import { AvailablePlayer, Game } from "../types";
import styles from "./ListPage.module.css"; // Reuse ListPage styles

const PlayPublicPage: React.FC = () => {
    const { socket, isConnected } = useSocket();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([]);
    const [isReady, setIsReady] = useState(false); // User's own ready status
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState("");

    const loadAvailablePlayers = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetchAvailablePlayersApi();
            setAvailablePlayers(response.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.msg || "Failed to fetch available players.");
            setAvailablePlayers([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAvailablePlayers();
        // Check if user is already in backend's ready_to_play_users (e.g. after refresh)
        // This is hard to check without a dedicated API endpoint or assuming local state is source of truth
        // For simplicity, we assume local `isReady` drives the state.
    }, [loadAvailablePlayers]);

    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleAvailablePlayersUpdate = (allPlayers: AvailablePlayer[]) => {
            console.log("All available players update received:", allPlayers);
            if (user && user.id) {
                const filteredPlayers = allPlayers.filter((player) => player.id !== user.id);
                setAvailablePlayers(filteredPlayers);
            } else {
                console.warn("User context not available for filtering player list.");
                setAvailablePlayers(allPlayers);
            }
        };

        const handleGameInvite = (data: { msg: string; game_details: Game }) => {
            setStatusMessage(`${data.msg} Room: ${data.game_details.room_id}. Joining...`);
            // Automatically navigate to the game room
            navigate(`/game/${data.game_details.room_id}`);
        };

        const handleGameStartedDirect = (data: { msg: string; game_details: Game }) => {
            // This is for the initiator of a "start with player" game
            setStatusMessage(`${data.msg} Room: ${data.game_details.room_id}. Joining...`);
            navigate(`/game/${data.game_details.room_id}`);
        };

        socket.on("available_players_update", handleAvailablePlayersUpdate);
        socket.on("game_invite", handleGameInvite); // For the challenged player
        socket.on("game_started_direct", handleGameStartedDirect); // For the challenger

        return () => {
            socket.off("available_players_update", handleAvailablePlayersUpdate);
            socket.off("game_invite", handleGameInvite);
            socket.off("game_started_direct", handleGameStartedDirect);
        };
    }, [socket, isConnected, navigate, user]);

    const toggleReadyStatus = async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (isReady) {
                await setUnreadyToPlayApi();
                setIsReady(false);
                setStatusMessage("You are no longer marked as ready to play.");
            } else {
                await setReadyToPlayApi();
                setIsReady(true);
                setStatusMessage("You are now ready to play! Waiting for matches or select a player.");
            }
            // The socket event 'available_players_update' should refresh the list
        } catch (err: any) {
            setError(err.response?.data?.msg || "Failed to update ready status.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartGame = async (opponentId: number) => {
        setIsLoading(true);
        setError(null);
        setStatusMessage(`Attempting to start game...`);
        try {
            const response = await startGameWithPlayerApi(opponentId);
            // Navigation will be handled by 'game_started_direct' socket event for the initiator
            // or GamePage will fetch details. The response gives game details.
            // const gameDetails: Game = response.data.game_details;
            // navigate(`/game/${gameDetails.room_id}`); // This can be done here or via socket event
            console.log("Start game API call successful, waiting for socket event to navigate.");
        } catch (err: any) {
            setError(err.response?.data?.msg || "Failed to start game with player.");
            // If failed, refresh available players as opponent might no longer be available
            loadAvailablePlayers();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.listContainer}>
            <h2>Play a Public Game</h2>
            {error && <p className={`${styles.centerMessage} ${styles.error}`}>{error}</p>}
            {statusMessage && <p className={styles.centerMessage}>{statusMessage}</p>}

            <button onClick={toggleReadyStatus} disabled={isLoading} className={styles.actionButton} style={{ marginBottom: "20px", backgroundColor: isReady ? "#dc3545" : "#28a745" }}>
                {isLoading ? "Updating..." : isReady ? "Set as Not Ready" : "Set as Ready to Play"}
            </button>

            {isReady && (
                <>
                    <h3>Available Players to Challenge:</h3>
                    {isLoading && <p>Loading players...</p>}
                    {!isLoading && availablePlayers.length === 0 && <p>No other players are currently ready. Waiting for someone to join!</p>}
                    {!isLoading && availablePlayers.length > 0 && (
                        <ul className={styles.list}>
                            {availablePlayers.map((player) => (
                                <li key={player.id} className={styles.listItem}>
                                    <span>{player.username}</span>
                                    <button onClick={() => handleStartGame(player.id)} disabled={isLoading} className={styles.actionButton}>
                                        Challenge
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
            {!isReady && <p>Set yourself as "Ready to Play" to see available players or be challenged.</p>}
        </div>
    );
};

export default PlayPublicPage;
