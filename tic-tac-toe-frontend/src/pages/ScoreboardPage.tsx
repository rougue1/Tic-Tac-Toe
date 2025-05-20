import React, { useEffect, useState } from "react";
import { fetchScoreboard } from "../services/api";
import { ScoreboardEntry } from "../types";
import styles from "./ListPage.module.css"; // Reuse ListPage styles

const ScoreboardPage: React.FC = () => {
    const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadScoreboard = async () => {
            setIsLoading(true);
            try {
                const response = await fetchScoreboard();
                setScoreboard(response.data);
                setError(null);
            } catch (err: any) {
                setError(err.response?.data?.msg || "Failed to fetch scoreboard.");
                setScoreboard([]);
            } finally {
                setIsLoading(false);
            }
        };
        loadScoreboard();
    }, []);

    if (isLoading) return <div className={styles.centerMessage}>Loading scoreboard...</div>;
    if (error) return <div className={`${styles.centerMessage} ${styles.error}`}>{error}</div>;

    return (
        <div className={styles.listContainer} style={{ maxWidth: "500px" }}>
            <h2>Top Players</h2>
            {scoreboard.length === 0 ? (
                <p>No scores yet. Go win some games!</p>
            ) : (
                <ol className={styles.list} style={{ paddingLeft: "20px" }}>
                    {" "}
                    {/* Use OL for ranked list */}
                    {scoreboard.map((entry, index) => (
                        <li key={index} className={styles.listItem}>
                            <span>
                                <strong>
                                    {index + 1}. {entry.username}
                                </strong>
                            </span>
                            <span>{entry.wins} Wins</span>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
};

export default ScoreboardPage;
