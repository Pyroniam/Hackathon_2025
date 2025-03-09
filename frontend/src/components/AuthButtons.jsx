import React from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import "../styles.css"; // Import the CSS file

const AuthButtons = () => {
  const { isSignedIn, user } = useUser();
  const { signOut, openSignIn } = useClerk();

  return (
    <div className="auth-buttons-container">
      {isSignedIn ? (
        <div className="signed-in-container">
          <p className="welcome-message">Welcome, {user.firstName}!</p>
          <button className="auth-button logout-button" onClick={() => signOut()}>
            Log Out
          </button>
        </div>
      ) : (
        <button className="auth-button login-button" onClick={() => openSignIn()}>
          Log In
        </button>
      )}
    </div>
  );
};

export default AuthButtons;
