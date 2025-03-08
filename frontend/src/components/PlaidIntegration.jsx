import React, { useState, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import axios from "axios";
import { Send, User, Clock, ChevronDown, ChevronUp } from "lucide-react";
import "../styles.css"; // Import the CSS file

const PlaidIntegration = () => {
  const [linkToken, setLinkToken] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [income, setIncome] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "ascending" });
  const [expandedMonths, setExpandedMonths] = useState({}); // Track expanded months

  // Fetch link token from backend
  useEffect(() => {
    const fetchLinkToken = async () => {
      try {
        const response = await axios.post("http://localhost:5000/api/create_link_token");
        setLinkToken(response.data.link_token);
      } catch (error) {
        console.error("Error creating link token:", error);
      }
    };
    fetchLinkToken();
  }, []);

  // Initialize Plaid Link
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken) => {
      try {
        setLoading(true);
        const response = await axios.post("http://localhost:5000/api/exchange_public_token", { public_token: publicToken });
        setAccessToken(response.data.access_token);
        fetchBankData(response.data.access_token);
      } catch (error) {
        console.error("Error exchanging token:", error);
      } finally {
        setLoading(false);
      }
    },
  });

  // Fetch accounts, transactions, and income data
  const fetchBankData = async (token) => {
    try {
      setLoading(true);

      // Fetch Transactions
      const transactionResponse = await axios.post("http://localhost:5000/api/transactions", { access_token: token });
      setTransactions(transactionResponse.data.transactions || []);

      // Fetch Income
      const incomeResponse = await axios.post("http://localhost:5000/api/income", { access_token: token });
      setIncome(incomeResponse.data.income || []);
    } catch (error) {
      console.error("❌ Error fetching financial data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to group transactions by month and calculate total spending
  const groupTransactionsByMonth = () => {
    const grouped = {};

    transactions.forEach((transaction) => {
      if (!transaction.date || !transaction.amount) return;

      const date = new Date(transaction.date);
      if (isNaN(date)) return;

      const year = date.getFullYear().toString();
      const month = date.toLocaleString("default", { month: "short" });

      if (!grouped[year]) {
        grouped[year] = [];
      }

      const monthData = grouped[year].find((m) => m.month === month);
      if (monthData) {
        monthData.transactions.push(transaction);
        monthData.total += Number(transaction.amount);
      } else {
        grouped[year].push({
          month,
          total: Number(transaction.amount),
          transactions: [transaction],
        });
      }
    });

    return grouped;
  };

  const groupedTransactions = groupTransactionsByMonth();

  // Function to handle sorting
  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  // Function to sort transactions
  const getSortedTransactions = (transactions) => {
    if (!sortConfig.key) return transactions;

    return [...transactions].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === "ascending" ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === "ascending" ? 1 : -1;
      }
      return 0;
    });
  };

  // Helper function to render sort indicator
  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) {
      return <span className="sort-indicator">⇅</span>;
    }
    return sortConfig.direction === "ascending" ? (
      <ChevronUp size={14} className="sort-indicator" />
    ) : (
      <ChevronDown size={14} className="sort-indicator" />
    );
  };

  return (
    <div className="finance-app">
      {/* Chat Section - Left Side */}
      <div className="chat-section">
        {/* Chat Content Area - Takes most of the space */}
        <div className="chat-content">
          {/* Chat 1 - Now showing time */}
          <div className="chat-message">
            <div className="chat-message-header">
              <div className="dot"></div>
              <span className="time">Today, 10:23 AM</span>
            </div>
            <div className="chat-bubble">
              "Can you set a grocery budget for me?"
            </div>
            <div className="text-blue-400">
              Sure! Based on your past grocery spending, I recommend $100 per week. Would you like me to track it and send you alerts if you exceed it?
            </div>
          </div>

          {/* Chat 2 - Now showing time */}
          <div className="chat-message">
            <div className="chat-message-header">
              <div className="dot"></div>
              <span className="time">Today, 10:25 AM</span>
            </div>
            <div className="chat-bubble user">
              Yes, please.
            </div>
            <div className="text-white">
              Done! I'll notify you if your grocery spending exceeds $100 in a week. You can check your balance anytime by asking, 'What's left in my grocery budget?'
            </div>
          </div>
        </div>

        {/* Chat Input - Now showing status */}
        <div className="chat-input">
          <div className="chat-message-header">
            <div className="dot"></div>
            <span className="time flex items-center">
              <Clock size={14} className="mr-1" />
              Assistant is ready
            </span>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Message about budgeting"
              className="w-full"
            />
            <button className="absolute right-0.5rem top-55% transform -translate-y-1/2">
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Section - Right Side */}
      <div className="transactions-section">
        {/* Add spacing at the top */}
        <div className="h-16"></div>

        {/* Connect Bank Account Button */}
        <div className="connect-button-container">
          <button
            onClick={open}
            disabled={!ready || !linkToken}
            className="connect-button"
          >
            Connect Bank Account
          </button>
        </div>

        {/* Year Dropdown and Transactions (Conditional Rendering) */}
        {accessToken && (
          <>
            <div className="year-dropdown">
              <div
                className="year-dropdown-header"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span>Year: {selectedYear}</span>
                <ChevronDown size={20} />
              </div>

              {isDropdownOpen && (
                <div className="year-dropdown-list">
                  {Object.keys(groupedTransactions).map((year) => (
                    <div
                      key={year}
                      onClick={() => {
                        setSelectedYear(year);
                        setIsDropdownOpen(false);
                      }}
                    >
                      {year}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Monthly Transactions for Selected Year */}
            {groupedTransactions[selectedYear]?.map((monthData, index) => (
              <div key={index} className="month-transactions">
                {/* Month Header (Clickable) */}
                <div
                  className="month-header"
                  onClick={() =>
                    setExpandedMonths((prev) => ({
                      ...prev,
                      [monthData.month]: !prev[monthData.month],
                    }))
                  }
                >
                  <div className="month-header-left">{monthData.month}</div>
                    <div className="month-header-right">
                      <div>Total: ${monthData.total.toFixed(2)}</div>
                      <ChevronDown size={20} className={expandedMonths[monthData.month] ? "transform rotate-180" : ""} />
                    </div>
                </div>

                {/* Transactions (Conditional Rendering) */}
                {expandedMonths[monthData.month] && (
                  <>
                    {/* Table Header with Sortable Columns */}
                    <div className="transaction-table">
                      <div>Name</div>
                      <div>Amount</div>
                      <div
                        className="cursor-pointer flex items-center"
                        onClick={() => requestSort("date")}
                      >
                        Date {getSortIndicator("date")}
                      </div>
                    </div>

                    {/* Transactions - Now Sortable */}
                    {getSortedTransactions(monthData.transactions).map((transaction, tIndex) => (
                      <div key={tIndex} className="transaction-row">
                        <div>{transaction.name || "Unknown Transaction"}</div>
                        <div>${(transaction.amount || 0).toFixed(2)}</div>
                        <div>{transaction.date ? new Date(transaction.date).toDateString() : "Invalid Date"}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* User Profile Icon */}
      <div className="user-profile">
        <div>
          <User color="black" size={24} />
        </div>
      </div>
    </div>
  );
};

export default PlaidIntegration;