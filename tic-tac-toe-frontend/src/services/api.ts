import axios from "axios";
import { AuthResponse, User } from "../types"; // We'll define these later

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Interceptor to add JWT token to requests
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("accessToken");
        if (token) {
            config.headers["Authorization"] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Auth services
export const registerUser = (data: any) => apiClient.post("/auth/register", data);
export const loginUser = (data: any) => apiClient.post<AuthResponse>("/auth/login", data);
export const fetchCurrentUser = () => apiClient.get<User>("/auth/me");
export const fetchScoreboard = () => apiClient.get("/auth/scoreboard");

// Room services
export const createRoomApi = (data: { is_public: boolean }) => apiClient.post("/api/rooms", data);
export const fetchPublicRoomsApi = () => apiClient.get("/api/rooms/public");
export const joinRoomApi = (roomId: string) => apiClient.post(`/api/rooms/${roomId}/join`);
export const getGameDetailsApi = (roomId: string) => apiClient.get(`/api/game/${roomId}`);

// Public Matchmaking services
export const setReadyToPlayApi = () => apiClient.post("/api/play/ready");
export const setUnreadyToPlayApi = () => apiClient.post("/api/play/unready");
export const fetchAvailablePlayersApi = () => apiClient.get("/api/play/available");
export const startGameWithPlayerApi = (opponentId: number) => apiClient.post(`/api/play/start_with/${opponentId}`);

// Friend services
export const fetchFriendsApi = () => apiClient.get("/api/friends");
export const fetchFriendRequestsApi = () => apiClient.get("/api/friends/requests");
export const sendFriendRequestApi = (addresseeUserId: number) => apiClient.post(`/api/friends/send_request/${addresseeUserId}`);
export const respondToFriendRequestApi = (requestId: number, status: "accepted" | "declined") => apiClient.post(`/api/friends/respond_request/${requestId}`, { status });
export const searchUsersApi = (query: string) => apiClient.get(`/api/users/search?q=${query}`);

export default apiClient;
