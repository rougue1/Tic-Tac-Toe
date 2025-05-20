import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { joinRoomApi } from "../services/api";
import { Game } from "../types";
import styles from "./FormPage.module.css";

const JoinRoomPage: React.FC = () => {
    const [roomId, setRoomId] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!roomId.trim()) {
            setError("Room Code cannot be empty.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await joinRoomApi(roomId.toUpperCase()); // Room codes are uppercase
            const gameDetails: Game = response.data.game_details;
            navigate(`/game/${gameDetails.room_id}`);
        } catch (err: any) {
            setError(err.response?.data?.msg || "Failed to join room. Check the code or room status.");
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.formContainer}>
            <h2>Join Room by Code</h2>
            {error && <p className={styles.error}>{error}</p>}
            <form onSubmit={handleSubmit}>
                <div className={styles.formGroup}>
                    <label htmlFor="roomId">Room Code</label>
                    <input
                        type="text"
                        id="roomId"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        placeholder="Enter 6-character code"
                        maxLength={10} // Room codes are 6 chars, but allow a bit more for paste errors
                        required
                    />
                </div>
                <button type="submit" disabled={isLoading} className={styles.submitButton}>
                    {isLoading ? "Joining..." : "Join Room"}
                </button>
            </form>
        </div>
    );
};

export default JoinRoomPage;
