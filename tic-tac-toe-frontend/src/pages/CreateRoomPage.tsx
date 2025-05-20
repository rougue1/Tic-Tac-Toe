import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoomApi } from "../services/api";
import { Game } from "../types";
import styles from "./FormPage.module.css"; // A generic style for form pages

const CreateRoomPage: React.FC = () => {
    const [isPublic, setIsPublic] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            const response = await createRoomApi({ is_public: isPublic });
            const gameDetails: Game = response.data.game_details;
            navigate(`/game/${gameDetails.room_id}`);
        } catch (err: any) {
            setError(err.response?.data?.msg || "Failed to create room.");
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.formContainer}>
            <h2>Create a New Game Room</h2>
            {error && <p className={styles.error}>{error}</p>}
            <form onSubmit={handleSubmit}>
                <div className={styles.formGroup}>
                    <label>
                        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                        Public Room (visible to others)
                    </label>
                </div>
                <button type="submit" disabled={isLoading} className={styles.submitButton}>
                    {isLoading ? "Creating..." : "Create Room"}
                </button>
            </form>
        </div>
    );
};

export default CreateRoomPage;
