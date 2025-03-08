require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");

const app = express();
app.use(express.json());
app.use(cors());

const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  })
);

// Generate a link token
app.post("/api/create_link_token", async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      user: { client_user_id: "unique-user-id" },
      client_name: "Finance Advisor",
      products: ["auth", "transactions"],
      country_codes: ["US"],
      language: "en",
    });
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error("❌ Error creating link token:", error.response?.data || error);
    res.status(500).json({ error: "Failed to create link token" });
  }
});

// Exchange public token for access token
app.post("/api/exchange_public_token", async (req, res) => {
  try {
    const { public_token } = req.body;
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    res.json({ access_token: response.data.access_token });
  } catch (error) {
    console.error("❌ Error exchanging public token:", error.response?.data || error);
    res.status(500).json({ error: "Failed to exchange public token" });
  }
});

// Fetch accounts
app.post("/api/accounts", async (req, res) => {
  try {
    const { access_token } = req.body;
    const response = await plaidClient.accountsGet({ access_token });
    res.json({ accounts: response.data.accounts });
  } catch (error) {
    console.error("❌ Error fetching accounts:", error.response?.data || error);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

// Fetch transactions
app.post("/api/transactions", async (req, res) => {
  try {
    const { access_token } = req.body;
    const response = await plaidClient.transactionsGet({
      access_token,
      start_date: "2024-01-01",
      end_date: new Date().toISOString().split("T")[0],
    });
    res.json({ transactions: response.data.transactions });
  } catch (error) {
    console.error("❌ Error fetching transactions:", error.response?.data || error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// Fetch income data from transactions
app.post("/api/income", async (req, res) => {
  try {
    const { access_token } = req.body;

    // Fetch transactions from the past 90 days
    const response = await plaidClient.transactionsGet({
      access_token,
      start_date: new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split("T")[0], // 90 days ago
      end_date: new Date().toISOString().split("T")[0],
    });

    const transactions = response.data.transactions;

    // Identify recurring income (e.g., direct deposits)
    const incomeTransactions = transactions.filter((tx) =>
      tx.category && tx.category.includes("Payroll")
    );

    // Group income by employer/source
    const incomeBySource = incomeTransactions.reduce((acc, tx) => {
      if (!acc[tx.name]) acc[tx.name] = { total: 0, count: 0 };
      acc[tx.name].total += tx.amount;
      acc[tx.name].count += 1;
      return acc;
    }, {});

    // Calculate estimated monthly income
    const incomeData = Object.keys(incomeBySource).map((source) => ({
      source,
      avgMonthlyIncome: (incomeBySource[source].total / incomeBySource[source].count) * 2, // Assuming biweekly pay
    }));

    res.json({ income: incomeData });
  } catch (error) {
    console.error("❌ Error fetching income data:", error.response?.data || error);
    res.status(500).json({ error: "Failed to fetch income data" });
  }
});

app.listen(5000, () => console.log("✅ Server running on port 5000"));