import React, { useState } from "react";
import { useUser } from "@clerk/clerk-react"; // Import useUser hook
import AuthButtons from "./components/AuthButtons"; // Import AuthButtons component
import PlaidIntegration from "./components/PlaidIntegration";
import AccountInfo from "./components/AccountInfo";

function App() {
  const [accessToken, setAccessToken] = useState(null);
  const { isSignedIn } = useUser(); // Check if the user is signed in

  return (
    <div>
      {/* Display Login/Logout Buttons */}
      <AuthButtons />

      {/* Conditionally Render PlaidIntegration and AccountInfo */}
      {isSignedIn ? (
        <>
          <PlaidIntegration setAccessToken={setAccessToken} />
          {accessToken && <AccountInfo accessToken={accessToken} />}
        </>
      ) : (
        <p>Please log in to access the financial advisor.</p>
      )}
    </div>
  );
}

export default App;