const connectDB = require("./config/mongodb");
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
connectDB();
const userRoutes = require("./routes/userRoutes");
app.use("/api/users", userRoutes);
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
    console.error(
      "❌ Error creating link token:",
      error.response?.data || error
    );
    res.status(500).json({ error: "Failed to create link token" });
  }
});

// Exchange public token for access token
app.post("/api/exchange_public_token", async (req, res) => {
  try {
    const { public_token } = req.body;
    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });
    res.json({ access_token: response.data.access_token });
  } catch (error) {
    console.error(
      "❌ Error exchanging public token:",
      error.response?.data || error
    );
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
    console.error(
      "❌ Error fetching transactions:",
      error.response?.data || error
    );
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
      start_date: new Date(new Date().setDate(new Date().getDate() - 90))
        .toISOString()
        .split("T")[0], // 90 days ago
      end_date: new Date().toISOString().split("T")[0],
    });

    const transactions = response.data.transactions;

    // Identify recurring income (e.g., direct deposits)
    const incomeTransactions = transactions.filter(
      (tx) => tx.category && tx.category.includes("Payroll")
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
      avgMonthlyIncome:
        (incomeBySource[source].total / incomeBySource[source].count) * 2, // Assuming biweekly pay
    }));

    res.json({ income: incomeData });
  } catch (error) {
    console.error(
      "❌ Error fetching income data:",
      error.response?.data || error
    );
    res.status(500).json({ error: "Failed to fetch income data" });
  }
});

const financialPrompts = JSON.parse(
  fs.readFileSync(path.join(__dirname, "datasets", "financial_prompts.json"))
);

// const isGreeting = (query) => {
//   const greetings = [
//     "hello",
//     "hi",
//     "hey",
//     "good morning",
//     "good afternoon",
//     "good evening",
//     "howdy",
//     "greetings",
//   ];
//   return greetings.some((greeting) => query.toLowerCase().includes(greeting));
// };

// Preprocess financial data for Gemini
const preprocessFinancialData = (financialData) => {
  if (!financialData) return null;
  const accounts = financialData.accounts.map((account) => ({
    account_id: account.account_id,
    name: account.name,
    official_name: account.official_name,
    type: account.type,
    subtype: account.subtype,
    balance_available: account.balances.available,
    balance_current: account.balances.current,
    currency: account.balances.iso_currency_code,
  }));

  const transactions = financialData.transactions.map((transaction) => ({
    transaction_id: transaction.transaction_id,
    account_id: transaction.account_id,
    date: transaction.date,
    amount: transaction.amount,
    currency: transaction.iso_currency_code,
    category: transaction.category
      ? transaction.category.join(" > ")
      : "Uncategorized",
    merchant_name: transaction.merchant_name || "Unknown",
    payment_channel: transaction.payment_channel,
    pending: transaction.pending,
  }));

  const income = financialData.income.map((tx) => ({
    transaction_id: tx.transaction_id,
    date: tx.date,
    amount: tx.amount,
    source: tx.name || "Unknown",
  }));

  return { accounts, transactions, income };
};

app.post("/api/chat", async (req, res) => {
  const { query, access_token } = req.body;

  // if (isGreeting(query)) {
  //   return res.json({
  //     response:
  //       "Hi there! How can I assist you with your financial goals today?",
  //   });
  // }

  let financialData = null;
  if (access_token) {
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
          start_date: new Date(new Date().setDate(new Date().getDate() - 90))
            .toISOString()
            .split("T")[0],
          end_date: new Date().toISOString().split("T")[0],
        }),
      ]);

      financialData = {
        accounts: accounts.data.accounts,
        transactions: transactions.data.transactions,
        income: income.data.transactions.filter(
          (tx) => tx.category && tx.category.includes("Payroll")
        ),
      };
    } catch (error) {
      console.error("❌ Error fetching financial data:", error);
      return res.status(500).json({ error: "Failed to fetch financial data" });
    }
  }

  // Preprocess financial data
  const processedData = preprocessFinancialData(financialData);
  // Check if the query matches any financial context prompt
  let responseText = "No relevant financial advice available.";
  for (const prompt of financialPrompts) {
    if (query.toLowerCase().includes(prompt.input.toLowerCase())) {
      responseText = prompt.output;
      break;
    }
  }
  // console.log(JSON.stringify(processedData.accounts, null, 2));
  // console.log(JSON.stringify(processedData.transactions, null, 2));
  // console.log(JSON.stringify(processedData.income, null, 2));

  // Use Gemini if no direct match is found
  if (responseText === "No relevant financial advice available.") {
    try {
      const geminiPrompt = `
        You are a financial advisor named Profit Prophet. Only respond with financial advice related to budgeting, saving, investing, managing debt, or general finance. If the user greets you, act enthusiastic to help. As an introduction speak concisely and very short.

        The following is a financial query:
        "${query}"

        Please provide your response focusing on financial topics.
        Use the following financial data to inform your response:

        Accounts: ${
          processedData
            ? JSON.stringify(processedData.accounts, null, 2)
            : "No accounts available"
        }
        Transactions: ${
          processedData
            ? JSON.stringify(processedData.transactions, null, 2)
            : "No transactions available"
        }
        Income: ${
          processedData
            ? JSON.stringify(processedData.income, null, 2)
            : "No income available"
        }`;

      const geminiResponse = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent`,
        {
          contents: [
            {
              parts: [{ text: geminiPrompt }],
            },
          ],generationConfig: {
            temperature: 0.4, // Set the temperature here
          },
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
        geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No response from Gemini";
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
