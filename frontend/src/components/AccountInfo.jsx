import React, { useEffect, useState } from "react";
import axios from "axios";

const AccountInfo = ({ accessToken }) => {
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    if (!accessToken) return;
    const fetchAccounts = async () => {
      try {
        const response = await axios.post("http://localhost:5000/api/get_accounts", { access_token: accessToken });
        setAccounts(response.data.accounts);
      } catch (error) {
        console.error("Error fetching accounts:", error);
      }
    };
    fetchAccounts();
  }, [accessToken]);

  return (
    <div>
      <h2>Bank Accounts</h2>
      <ul>
        {accounts.map((account) => (
          <li key={account.account_id}>
            {account.name}: ${account.balances.current}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AccountInfo;