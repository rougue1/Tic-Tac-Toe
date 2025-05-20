import React, { useEffect } from "react";
import { useFriends } from "../hooks/useFriends"; // Import the custom hook
import { useDebounce } from "../hooks/useDebounce"; // We'll create this next
import styles from "./FriendsPage.module.css";

const FriendsPage: React.FC = () => {
    const { friends, friendRequests, searchResults, searchQuery, setSearchQuery, isLoadingFriends, isLoadingRequests, isLoadingSearch, error, successMessage, handleSearchUsers, handleSendFriendRequest, handleRespondToRequest } = useFriends();

    // Debounce search query
    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    useEffect(() => {
        if (debouncedSearchQuery.trim().length >= 2) {
            handleSearchUsers(); // Call search without event when debounced value changes
        } else if (debouncedSearchQuery.trim().length === 0) {
            // Clear results if search query is cleared after being populated
            // setSearchResults([]); // This should be handled inside useFriends or by not calling search
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearchQuery]); // `handleSearchUsers` needs to be stable or included if it changes

    return (
        <div className={styles.friendsContainer}>
            <h2>Friends Management</h2>
            {error && <p className={styles.errorMessage}>{error}</p>}
            {successMessage && <p className={styles.successMessage}>{successMessage}</p>}

            <div className={styles.section}>
                <h3>Your Friends ({friends.length})</h3>
                {isLoadingFriends && <p>Loading friends...</p>}
                {!isLoadingFriends && friends.length === 0 && <p>You have no friends yet. Add some!</p>}
                <ul className={styles.list}>
                    {friends.map((friend) => (
                        <li key={friend.id} className={`${styles.listItem} ${friend.online ? styles.online : styles.offline}`}>
                            {friend.username}
                            <span className={styles.statusIndicator}>{friend.online ? "Online" : "Offline"}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className={styles.section}>
                <h3>Friend Requests ({friendRequests.length})</h3>
                {isLoadingRequests && <p>Loading requests...</p>}
                {!isLoadingRequests && friendRequests.length === 0 && <p>No pending friend requests.</p>}
                <ul className={styles.list}>
                    {friendRequests.map((req) => (
                        <li key={req.request_id} className={styles.listItem}>
                            <span>{req.requester_username} wants to be your friend.</span>
                            <div>
                                <button onClick={() => handleRespondToRequest(req.request_id, "accepted")} className={styles.acceptButton}>
                                    Accept
                                </button>
                                <button onClick={() => handleRespondToRequest(req.request_id, "declined")} className={styles.declineButton}>
                                    Decline
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <div className={styles.section}>
                <h3>Add Friends</h3>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSearchUsers(e);
                    }}
                    className={styles.searchForm}
                >
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search users by username (min 2 chars)" />
                    <button type="submit" disabled={isLoadingSearch}>
                        {isLoadingSearch ? "Searching..." : "Search"}
                    </button>
                </form>
                {isLoadingSearch && searchQuery.length >= 2 && <p>Searching...</p>} {/* Show searching only if query is valid */}
                {searchResults.length > 0 && (
                    <ul className={styles.list}>
                        <h4>Search Results:</h4>
                        {searchResults.map((foundUser) => (
                            <li key={foundUser.id} className={styles.listItem}>
                                {foundUser.username}
                                <button onClick={() => handleSendFriendRequest(foundUser.id)} className={styles.addButton}>
                                    Add Friend
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {!isLoadingSearch && debouncedSearchQuery.length >= 2 && searchResults.length === 0 && <p>No users found matching "{debouncedSearchQuery}".</p>}
            </div>
        </div>
    );
};

export default FriendsPage;
