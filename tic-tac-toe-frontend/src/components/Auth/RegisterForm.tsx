import React, { useState, FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import styles from "./AuthForm.module.css"; // Create this CSS file

const RegisterForm: React.FC = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        try {
            await register({ username, password });
            setSuccess("Registration successful! Please login.");
            // navigate('/login'); // Or auto-login
        } catch (err: any) {
            setError(err.response?.data?.msg || "Registration failed. Please try again.");
            console.error(err);
        }
    };

    return (
        <div className={styles.authContainer}>
            <h2>Register</h2>
            <form onSubmit={handleSubmit} className={styles.authForm}>
                {error && <p className={styles.error}>{error}</p>}
                {success && <p className={styles.success}>{success}</p>}
                <div className={styles.formGroup}>
                    <label htmlFor="username">Username</label>
                    <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="password">Password</label>
                    <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
                <button type="submit" className={styles.submitButton}>
                    Register
                </button>
            </form>
            <p>
                Already have an account? <a href="/login">Login here</a>
            </p>
        </div>
    );
};

export default RegisterForm;
