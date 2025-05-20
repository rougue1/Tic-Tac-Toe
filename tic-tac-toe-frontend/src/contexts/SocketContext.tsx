import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext"; // To get the token

const SOCKET_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    connectSocket: () => void;
    disconnectSocket: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const { token, isAuthenticated } = useAuth(); // Get token from AuthContext

    const connectSocket = () => {
        if (token && isAuthenticated && !socket?.connected) {
            console.log("Attempting to connect socket with token:", token ? "present" : "absent");
            const newSocket = io(SOCKET_URL, {
                // autoConnect: false, // We manage connection manually
                auth: {
                    token: token,
                },
            });

            newSocket.on("connect", () => {
                console.log("Socket connected:", newSocket.id);
                setIsConnected(true);
                // If backend requires explicit socket auth after connect event:
                // newSocket.emit('authenticate_socket', { token });
            });

            newSocket.on("disconnect", (reason) => {
                console.log("Socket disconnected:", reason);
                setIsConnected(false);
                // Handle reconnection logic if needed, or rely on Socket.IO's default
                if (reason === "io server disconnect") {
                    // The server explicitly disconnected the socket
                    newSocket.connect(); // Or handle more gracefully
                }
            });

            newSocket.on("connect_error", (err: Error & { data?: any }) => {
                // Explicitly type err with optional data
                console.error("Socket connection error:", err.message, err.data);
                // Potentially handle auth errors here, e.g., if token is invalid

                // Use a type guard to check if 'data' exists and has the expected structure
                if (err.message === "invalid token" || (err as any).data?.message === "Token validation failed") {
                    console.error("Socket Auth Error - consider logging out user");
                    // Could trigger a logout or token refresh
                }
                // Alternative safe access without direct assertion in the condition:
                if (err.message === "invalid token") {
                    console.error("Socket Auth Error - consider logging out user (invalid token message)");
                } else if (err.data && typeof err.data === "object" && (err.data as any).message === "Token validation failed") {
                    console.error("Socket Auth Error - consider logging out user (Token validation failed in data)");
                }
            });

            newSocket.on("auth_error", (data: { message: string }) => {
                console.error("Socket Auth Error from server:", data.message);
                // Potentially logout or show error to user
            });

            setSocket(newSocket);
            // newSocket.connect(); // Explicitly connect if autoConnect is false
        } else if (!token && socket?.connected) {
            console.log("No token, disconnecting socket");
            socket.disconnect();
            setSocket(null);
            setIsConnected(false);
        }
    };

    const disconnectSocket = () => {
        if (socket) {
            console.log("Disconnecting socket");
            socket.disconnect();
            setSocket(null);
            setIsConnected(false);
        }
    };

    // Effect to manage socket connection based on auth state
    useEffect(() => {
        if (isAuthenticated && token) {
            connectSocket();
        } else {
            disconnectSocket();
        }

        return () => {
            disconnectSocket(); // Cleanup on unmount
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, token]); // Rerun when auth state changes

    return <SocketContext.Provider value={{ socket, isConnected, connectSocket, disconnectSocket }}>{children}</SocketContext.Provider>;
};

export const useSocket = (): SocketContextType => {
    const context = useContext(SocketContext);
    if (context === undefined) {
        throw new Error("useSocket must be used within a SocketProvider");
    }
    return context;
};
