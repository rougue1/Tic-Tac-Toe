import React, { useState, FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import styles from "./AuthForm.module.css"; // Create this CSS file

const LoginForm: React.FC = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await login({ username, password });
            navigate("/"); // Redirect to home page after login
        } catch (err: any) {
            const errorMessage = err.response?.data?.msg || err.message || "Login failed. Please try again.";
            setError(errorMessage);
            console.error("Login handleSubmit error:", err);
        }
    };

    return (
        <div className={styles.authContainer}>
            <h2>Login</h2>
            <form onSubmit={handleSubmit} className={styles.authForm}>
                {error && <p className={styles.error}>{error}</p>}
                <div className={styles.formGroup}>
                    <label htmlFor="username">Username</label>
                    <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="password">Password</label>
                    <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button type="submit" className={styles.submitButton}>
                    Login
                </button>
            </form>
            <p>
                Don't have an account? <a href="/register">Register here</a>
            </p>
        </div>
    );
};

export default LoginForm;
