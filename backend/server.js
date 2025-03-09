require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");
const fs = require("fs");
const app = express();
app.use(express.json());
app.use(cors());
const axios = require("axios");
const path = require("path");
require("dotenv").config();
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
const financialPrompts = JSON.parse(
  fs.readFileSync(path.join(__dirname, "datasets", "financial_prompts.json"))
);

app.post("/api/chat", async (req, res) => {
  const { query, access_token } = req.body;

  console.log(access_token);
  let financialData = {};
  if(access_token){
  try {
    const [accounts, transactions, income] = await Promise.all([
      plaidClient.accountsGet({ access_token }),
      plaidClient.transactionsGet({
        access_token,
        start_date: "2024-01-01",
        end_date: new Date().toISOString().split("T")[0],
      }),
      plaidClient.transactionsGet({
        access_token,
        start_date: new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split("T")[0],
        end_date: new Date().toISOString().split("T")[0],
      }),
    ]);

    financialData = {
      accounts: accounts.data.accounts,
      transactions: transactions.data.transactions,
      income: income.data.transactions.filter((tx) =>
        tx.category && tx.category.includes("Payroll")
      ),
    };
  } catch (error) {
    console.error("❌ Error fetching financial data:", error);
    return res.status(500).json({ error: "Failed to fetch financial data" });
  }
}

 
  // Check if the query matches any financial context prompt
  let responseText = "No relevant financial advice available.";
  for (const prompt of financialPrompts) {
    if (query.toLowerCase().includes(prompt.input.toLowerCase())) {
      responseText = prompt.output;
      break;
    }
  }

  // Use Gemini if no direct match is found
  if (responseText === "No relevant financial advice available.") {
    try {
      const geminiPrompt = `
        You are a financial advisor. Only respond with financial advice related to budgeting, saving, investing, managing debt, or general finance.
        The following is a financial query:
        "${query}"

        Please provide your response focusing on financial topics.
         Financial Data:
        Accounts: ${JSON.stringify(financialData.accounts)}
        Transactions: ${JSON.stringify(financialData.transactions)}
        Income: ${JSON.stringify(financialData.income)}`;

      const geminiResponse = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent`,
        {
          contents: [
            {
              parts: [{ text: geminiPrompt }],
            },
          ],
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          params: {
            key: process.env.GEMINI_API_KEY, 
          },
        }
      );

      responseText =
        geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini";
      
    } catch (error) {
      console.error("Error:", error.message);
      if (error.response) {
        console.error("Error data:", error.response.data);
        console.error("Error status:", error.response.status);
      }
      return res.status(500).json({ response: "Error processing request" });
    }
  }

  res.json({ response: responseText });
});

app.listen(5001, () => console.log("✅ Server running on port 5001"));