import React, { useState } from "react";
import PlaidIntegration from "./components/PlaidIntegration";
import AccountInfo from "./components/AccountInfo";



function App() {
  const [accessToken, setAccessToken] = useState(null);

  return (
    <div>
      <PlaidIntegration setAccessToken={setAccessToken} />
      {accessToken && <AccountInfo accessToken={accessToken} />}
    </div>
  );
}

export default App;
