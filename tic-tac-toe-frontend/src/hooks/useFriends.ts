import { useState, useEffect, useCallback } from "react";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import { fetchFriendsApi, fetchFriendRequestsApi, sendFriendRequestApi, respondToFriendRequestApi, searchUsersApi } from "../services/api";
import { Friend, FriendRequest, SearchedUser, FriendStatusUpdatePayload, FriendRequestReceivedPayload, FriendRequestRespondedPayload } from "../types";

interface UseFriendsReturn {
    friends: Friend[];
    friendRequests: FriendRequest[];
    searchResults: SearchedUser[];
    searchQuery: string;
    setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
    isLoadingFriends: boolean;
    isLoadingRequests: boolean;
    isLoadingSearch: boolean;
    error: string | null;
    successMessage: string | null;
    handleSearchUsers: (e?: React.FormEvent) => Promise<void>; // Make event optional for debounced calls
    handleSendFriendRequest: (addresseeId: number) => Promise<void>;
    handleRespondToRequest: (requestId: number, status: "accepted" | "declined") => Promise<void>;
    clearMessages: () => void;
}

export const useFriends = (): UseFriendsReturn => {
    const { socket, isConnected } = useSocket();
    const { user } = useAuth();

    const [friends, setFriends] = useState<Friend[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    const [isLoadingFriends, setIsLoadingFriends] = useState(false);
    const [isLoadingRequests, setIsLoadingRequests] = useState(false);
    const [isLoadingSearch, setIsLoadingSearch] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const clearMessages = useCallback(() => {
        setError(null);
        setSuccessMessage(null);
    }, []);

    const loadFriends = useCallback(async () => {
        setIsLoadingFriends(true);
        try {
            const response = await fetchFriendsApi();
            setFriends(response.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.msg || "Failed to load friends list.");
        } finally {
            setIsLoadingFriends(false);
        }
    }, []);

    const loadFriendRequests = useCallback(async () => {
        setIsLoadingRequests(true);
        try {
            const response = await fetchFriendRequestsApi();
            setFriendRequests(response.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.msg || "Failed to load friend requests.");
        } finally {
            setIsLoadingRequests(false);
        }
    }, []);

    useEffect(() => {
        loadFriends();
        loadFriendRequests();
    }, [loadFriends, loadFriendRequests]);

    useEffect(() => {
        if (!socket || !isConnected || !user) return;

        const handleFriendStatusUpdate = (data: FriendStatusUpdatePayload) => {
            setFriends((prevFriends) => prevFriends.map((f) => (f.id === data.user_id ? { ...f, online: data.online } : f)));
            // Small notification, or rely on list updating
            // setSuccessMessage(`${data.username} is now ${data.online ? 'online' : 'offline'}`);
        };

        const handleFriendRequestReceived = (data: FriendRequestReceivedPayload) => {
            setSuccessMessage(`New friend request from ${data.requester_username}!`);
            setFriendRequests((prev) => {
                if (!prev.find((req) => req.request_id === data.request_id)) {
                    return [...prev, data];
                }
                return prev;
            });
        };

        const handleFriendRequestResponded = (data: FriendRequestRespondedPayload) => {
            if (data.status === "accepted") {
                setSuccessMessage(`${data.addressee_username} accepted your friend request!`);
                loadFriends();
            } else {
                setSuccessMessage(`${data.addressee_username} declined your friend request.`);
            }
        };

        const handleFriendListUpdate = (updatedFriends: Friend[]) => {
            setFriends(updatedFriends);
            setSuccessMessage("Your friend list has been updated.");
        };

        socket.on("friend_status_update", handleFriendStatusUpdate);
        socket.on("friend_request_received", handleFriendRequestReceived);
        socket.on("friend_request_responded", handleFriendRequestResponded);
        socket.on("friend_list_update", handleFriendListUpdate);

        return () => {
            socket.off("friend_status_update", handleFriendStatusUpdate);
            socket.off("friend_request_received", handleFriendRequestReceived);
            socket.off("friend_request_responded", handleFriendRequestResponded);
            socket.off("friend_list_update", handleFriendListUpdate);
        };
    }, [socket, isConnected, user, loadFriends]);

    const handleSearchUsers = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (searchQuery.trim().length < 2) {
            setSearchResults([]);
            // setError("Search query must be at least 2 characters."); // Maybe too noisy
            return;
        }
        setIsLoadingSearch(true);
        clearMessages();
        try {
            const response = await searchUsersApi(searchQuery);
            setSearchResults(response.data);
        } catch (err: any) {
            setError(err.response?.data?.msg || "Failed to search users.");
        } finally {
            setIsLoadingSearch(false);
        }
    };

    const handleSendFriendRequest = async (addresseeId: number) => {
        clearMessages();
        try {
            const response = await sendFriendRequestApi(addresseeId);
            setSuccessMessage(response.data.msg || "Friend request sent!");
            // Remove from search results or mark as pending
            setSearchResults((prev) => prev.filter((u) => u.id !== addresseeId));
        } catch (err: any) {
            setError(err.response?.data?.msg || "Failed to send friend request.");
        }
    };

    const handleRespondToRequest = async (requestId: number, status: "accepted" | "declined") => {
        clearMessages();
        try {
            const response = await respondToFriendRequestApi(requestId, status);
            setSuccessMessage(response.data.msg || `Request ${status}.`);
            loadFriendRequests();
            if (status === "accepted") {
                loadFriends();
            }
        } catch (err: any) {
            setError(err.response?.data?.msg || `Failed to respond to request.`);
        }
    };

    useEffect(() => {
        if (successMessage || error) {
            const timer = setTimeout(() => {
                clearMessages();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, error, clearMessages]);

    return {
        friends,
        friendRequests,
        searchResults,
        searchQuery,
        setSearchQuery,
        isLoadingFriends,
        isLoadingRequests,
        isLoadingSearch,
        error,
        successMessage,
        handleSearchUsers,
        handleSendFriendRequest,
        handleRespondToRequest,
        clearMessages,
    };
};
