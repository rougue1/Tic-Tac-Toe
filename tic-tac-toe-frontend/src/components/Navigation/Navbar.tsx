import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./Navbar.module.css"; // Create this file

const Navbar: React.FC = () => {
    const { isAuthenticated, user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <nav className={styles.navbar}>
            <Link to="/" className={styles.navBrand}>
                Tic-Tac-Toe
            </Link>
            <ul className={styles.navLinks}>
                {isAuthenticated ? (
                    <>
                        <li>
                            <Link to="/">Home</Link>
                        </li>
                        <li>
                            <Link to="/scoreboard">Scoreboard</Link>
                        </li>
                        <li>
                            <Link to="/friends">Friends</Link>
                        </li>
                        <li className={styles.userInfo}>Logged in as: {user?.username}</li>
                        <li>
                            <button onClick={handleLogout} className={styles.navButton}>
                                Logout
                            </button>
                        </li>
                    </>
                ) : (
                    <>
                        <li>
                            <Link to="/login">Login</Link>
                        </li>
                        <li>
                            <Link to="/register">Register</Link>
                        </li>
                    </>
                )}
            </ul>
        </nav>
    );
};

export default Navbar;
