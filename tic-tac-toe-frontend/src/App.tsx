import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";

import Navbar from "./components/Navigation/Navbar";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
// Placeholders for other pages - we will create these in Part 2
import ScoreboardPage from "./pages/ScoreboardPage"; // Create this
import FriendsPage from "./pages/FriendsPage"; // Create this
import GamePage from "./pages/GamePage"; // Create this
import CreateRoomPage from "./pages/CreateRoomPage"; // Create this
import JoinRoomPage from "./pages/JoinRoomPage"; // Create this
import PublicRoomsPage from "./pages/PublicRoomsPage"; // Create this
import PlayPublicPage from "./pages/PlayPublicPage"; // Create this

import "./styles/global.css"; // Global styles

// Protected Route Component
const ProtectedRoute: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return <div>Loading...</div>; // Or a spinner component
    }

    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

// Public Route Component (for login/register, redirect if authenticated)
const PublicRoute: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading) {
        return <div>Loading...</div>;
    }
    return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
};

function AppContent() {
    // This component exists so Navbar can be inside Router and use useAuth
    return (
        <>
            <Navbar />
            <main className="container">
                {" "}
                {/* Add a class for main content styling */}
                <Routes>
                    {/* Public routes (redirect if logged in) */}
                    <Route element={<PublicRoute />}>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                    </Route>

                    {/* Protected routes */}
                    <Route element={<ProtectedRoute />}>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/game/:roomId" element={<GamePage />} />
                        <Route path="/scoreboard" element={<ScoreboardPage />} />
                        <Route path="/friends" element={<FriendsPage />} />
                        <Route path="/create-room" element={<CreateRoomPage />} />
                        <Route path="/join-room" element={<JoinRoomPage />} />
                        <Route path="/public-rooms" element={<PublicRoomsPage />} />
                        <Route path="/play-public" element={<PlayPublicPage />} />
                        {/* Add other protected routes here */}
                    </Route>

                    {/* Fallback for unmatched routes or a 404 component */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </>
    );
}

const App: React.FC = () => {
    return (
        <Router>
            <AuthProvider>
                {" "}
                {/* AuthProvider wraps SocketProvider so SocketProvider can useAuth */}
                <SocketProvider>
                    <AppContent />
                </SocketProvider>
            </AuthProvider>
        </Router>
    );
};

export default App;
