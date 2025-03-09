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
        <div className="main-description">
          <h1>Welcome to Profit Prophet</h1>
          <p>
            Profit Prophet is your AI-powered financial advisor, designed to help you make smarter
            spending decisions and achieve your financial goals. By analyzing your transactions and
            income, we provide personalized recommendations on how to budget, save, and invest your
            money effectively.
          </p>
          <p>
            Log in to connect your bank account and start receiving tailored advice on:
          </p>
          <ul>
            <li>Budgeting strategies</li>
            <li>Spending recommendations</li>
            <li>Savings goals</li>
            <li>Investment opportunities</li>
          </ul>
          <p>Take control of your finances today with Profit Prophet!</p>
        </div>
      )}
    </div>
  );
}

export default App;