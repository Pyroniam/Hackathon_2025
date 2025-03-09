import React from "react";
import { useUser, useClerk } from "@clerk/clerk-react";

const AuthButtons = () => {
  const { isSignedIn, user } = useUser();
  const { signOut, openSignIn } = useClerk();

  return (
    <div>
      {isSignedIn ? (
        <div>
          <p>Welcome, {user.firstName}!</p>
          <button onClick={() => signOut()}>Log Out</button>
        </div>
      ) : (
        <button onClick={() => openSignIn()}>Log In</button>
      )}
    </div>
  );
};

export default AuthButtons;