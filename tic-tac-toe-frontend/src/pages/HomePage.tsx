import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import styles from "./HomePage.module.css"; // Create this file

const HomePage: React.FC = () => {
    const { user, logout } = useAuth();

    return (
        <div className={styles.homeContainer}>
            <h1>Welcome to Tic-Tac-Toe, {user?.username}!</h1>
            <p>What would you like to do?</p>
            <div className={styles.actions}>
                <Link to="/create-room" className={styles.actionButton}>
                    Create Room
                </Link>
                <Link to="/join-room" className={styles.actionButton}>
                    Join Room by Code
                </Link>
                <Link to="/public-rooms" className={styles.actionButton}>
                    View Public Rooms
                </Link>
                <Link to="/play-public" className={styles.actionButton}>
                    Play a Public Game
                </Link>
                {/* <Link to="/game/some-room-id">Test Game Page</Link>  placeholder for direct game access */}
            </div>
            <button onClick={logout} className={styles.logoutButton}>
                Logout
            </button>
        </div>
    );
};

export default HomePage;
