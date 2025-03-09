import React, { useState, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import axios from "axios";
import { Send, User, ChevronDown, ChevronUp, ArrowLeft, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
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
  const [expandedMonths, setExpandedMonths] = useState({});
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // State for sidebar visibility

  // Fetch link token from backend
  useEffect(() => {
    const fetchLinkToken = async () => {
      try {
        const response = await axios.post("http://localhost:5001/api/create_link_token");
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
        const response = await axios.post("http://localhost:5001/api/exchange_public_token", { public_token: publicToken });
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
      const transactionResponse = await axios.post("http://localhost:5001/api/transactions", { access_token: token });
      setTransactions(transactionResponse.data.transactions || []);

      // Fetch Income
      const incomeResponse = await axios.post("http://localhost:5001/api/income", { access_token: token });
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

  // Prepare data for the bar chart
  const chartData = Object.keys(groupedTransactions).flatMap((year) =>
    groupedTransactions[year].map((monthData) => ({
      name: `${monthData.month} ${year}`,
      total: Math.abs(monthData.total), // Use absolute value for spending
    }))
  );

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

  const sendMessage = async () => {
    if (!input.trim()) return;

    const newMessages = [...messages, { text: input, sender: "user" }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      // Send the user query and access token to the backend for processing
      const { data } = await axios.post("http://localhost:5001/api/chat", { 
        query: input, 
        access_token: accessToken // Include the access token here
      });

      setMessages([...newMessages, { text: data.response, sender: "bot" }]);
    } catch (error) {
      console.error("Error:", error);
      setMessages([...newMessages, { text: "Error fetching response", sender: "bot" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="finance-app">
      {/* Chat Section - Left */}
      <div className="chat-section">
        <h2 className="chat-title">Finance Advisor</h2>
        <div className="chat-content">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.sender === "user" ? "user" : "bot"}`}>
              <div className="chat-bubble">{msg.text}</div>
            </div>
          ))}
          {loading && <p className="loading-text">Typing...</p>}
        </div>
        <div className="chat-input">
          <input
            type="text"
            className="chat-textbox"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a message..."
          />
          <button className="send-button" onClick={sendMessage} disabled={loading}>
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Transactions Section - Middle */}
      <div className="transactions-section">
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

        {/* Transaction List */}
        {accessToken && (
          <div className="transactions-container">
            {Object.keys(groupedTransactions).map((year) => (
              <div key={year}>
                <h3 className="year-header">{year}</h3>
                {groupedTransactions[year].map((monthData, index) => (
                  <div key={index} className="month-transactions">
                    <div className="month-header" onClick={() => 
                      setExpandedMonths((prev) => ({
                        ...prev,
                        [monthData.month]: !prev[monthData.month],
                      }))
                    }>
                      <span>{monthData.month}</span>
                      <span>Total: ${monthData.total.toFixed(2)}</span>
                    </div>

                    {expandedMonths[monthData.month] && (
                      <div className="transaction-list">
                        <div className="transaction-row">
                          <div>Name</div>
                          <div>Amount</div>
                          <div>Date</div>
                        </div>
                        {getSortedTransactions(monthData.transactions).map((transaction, tIndex) => (
                          <div key={tIndex} className="transaction-row">
                            <div>{transaction.name || "Unknown Transaction"}</div>
                            <div>${(transaction.amount || 0).toFixed(2)}</div>
                            <div>{transaction.date ? new Date(transaction.date).toDateString() : "Invalid Date"}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sidebar Toggle Button */}
      <button
  className="sidebar-toggle"
  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
>
  {isSidebarOpen ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
</button>

      {/* Chart Sidebar - Right */}
      <div className={`chart-sidebar ${isSidebarOpen ? "open" : ""}`}>
        <h3>Monthly Spending</h3>
        {accessToken && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p>No transaction data available.</p>
        )}
      </div>
    </div>
  );
};

export default PlaidIntegration;