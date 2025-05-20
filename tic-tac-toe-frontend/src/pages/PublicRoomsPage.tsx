import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPublicRoomsApi, joinRoomApi } from "../services/api";
import { Game } from "../types";
import styles from "./ListPage.module.css"; // A generic style for list pages

const PublicRoomsPage: React.FC = () => {
    const [publicRooms, setPublicRooms] = useState<Game[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const loadPublicRooms = async () => {
            setIsLoading(true);
            try {
                const response = await fetchPublicRoomsApi();
                setPublicRooms(response.data);
                setError(null);
            } catch (err: any) {
                setError(err.response?.data?.msg || "Failed to fetch public rooms.");
                setPublicRooms([]);
            } finally {
                setIsLoading(false);
            }
        };
        loadPublicRooms();
    }, []);

    const handleJoinRoom = async (roomId: string) => {
        try {
            const response = await joinRoomApi(roomId);
            const gameDetails: Game = response.data.game_details;
            navigate(`/game/${gameDetails.room_id}`);
        } catch (err: any) {
            setError(err.response?.data?.msg || `Failed to join room ${roomId}. It might be full or already started.`);
            // Optionally re-fetch rooms if one becomes invalid
            const updatedRooms = await fetchPublicRoomsApi();
            setPublicRooms(updatedRooms.data);
        }
    };

    if (isLoading) return <div className={styles.centerMessage}>Loading public rooms...</div>;
    if (error) return <div className={`${styles.centerMessage} ${styles.error}`}>{error}</div>;

    return (
        <div className={styles.listContainer}>
            <h2>Public Rooms Waiting for Players</h2>
            {publicRooms.length === 0 ? (
                <p>No public rooms available right now. Why not create one?</p>
            ) : (
                <ul className={styles.list}>
                    {publicRooms.map((room) => (
                        <li key={room.id} className={styles.listItem}>
                            <span>
                                Room <strong>{room.room_id}</strong> created by <strong>{room.player_x_username || "Unknown"}</strong>
                            </span>
                            <button onClick={() => handleJoinRoom(room.room_id)} className={styles.actionButton}>
                                Join
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default PublicRoomsPage;
