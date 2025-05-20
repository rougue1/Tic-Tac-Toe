import React, { createContext, useState, useContext, useEffect, ReactNode } from "react";
import { User } from "../types"; // AuthResponse is implicitly handled by apiLoginUser's return
import { fetchCurrentUser, loginUser as apiLoginUser, registerUser as apiRegisterUser } from "../services/api";

interface AuthContextType {
    isAuthenticated: boolean;
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (credentials: any) => Promise<void>;
    register: (credentials: any) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    // Initialize token directly from localStorage. This ensures that if the page is refreshed,
    // the token state starts with the persisted value.
    const [token, setToken] = useState<string | null>(() => localStorage.getItem("accessToken"));
    const [isLoading, setIsLoading] = useState<boolean>(true); // Start true until initial auth check completes

    useEffect(() => {
        const verifyTokenAndFetchUser = async () => {
            // Relies on the token state which was initialized from localStorage
            if (token) {
                try {
                    // The apiClient interceptor will use the token from localStorage
                    // (which should match our current `token` state if it came from there)
                    const response = await fetchCurrentUser();
                    setUser(response.data);
                } catch (error) {
                    console.error("Failed to fetch current user with stored token (e.g., expired):", error);
                    localStorage.removeItem("accessToken");
                    setToken(null);
                    setUser(null);
                }
            }
            setIsLoading(false);
        };

        verifyTokenAndFetchUser();
    }, [token]); // Re-verify if the token string itself changes externally (though usually it changes via login/logout)
    // For initial load, if token is null from localStorage, this effect still runs,
    // sees token is null, and quickly sets isLoading to false.

    const login = async (credentials: any) => {
        setIsLoading(true);
        try {
            const response = await apiLoginUser(credentials);
            const { access_token } = response.data;

            // 1. Store the token in localStorage FIRST.
            localStorage.setItem("accessToken", access_token);
            // 2. Update the token state. This will also trigger the useEffect above,
            //    but fetchCurrentUser will be called explicitly next anyway.
            setToken(access_token);

            // 3. Now, call fetchCurrentUser. The interceptor in `api.ts` will read
            //    the fresh token from localStorage.
            const userResponse = await fetchCurrentUser();
            setUser(userResponse.data);
            // isAuthenticated will be true because user and token are now set.
            setIsLoading(false);
        } catch (err: any) {
            console.error("Login failed:", err.response?.data?.msg || err.message);
            localStorage.removeItem("accessToken");
            setToken(null);
            setUser(null);
            setIsLoading(false);
            throw err; // Re-throw the error so the LoginForm can display it
        }
    };

    const register = async (credentials: any) => {
        // Registration does not log the user in automatically in this setup
        await apiRegisterUser(credentials);
    };

    const logout = () => {
        localStorage.removeItem("accessToken");
        setToken(null);
        setUser(null);
        // Redirecting to login ensures a clean state and re-evaluation of routes
        window.location.href = "/login";
    };

    // isAuthenticated is derived from whether we have a user and a token.
    // isLoading handles the initial check.
    const isAuthenticated = !isLoading && !!user && !!token;

    return <AuthContext.Provider value={{ isAuthenticated, user, token, isLoading, login, register, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
