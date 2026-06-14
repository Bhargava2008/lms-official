// -------------------- IMPORTS --------------------
require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");

require("dotenv").config();

const { logger } = require("./middleware/logEvents");
const corsOptions = require("./config/corsOptions");
const credentials = require("./middleware/credentials");
const errorHandler = require("./middleware/errorHandler");
const verifyJWT = require("./middleware/verifyJWT");
const mongoose = require("mongoose");
const connectDB = require("./config/dbConn");

// connect to MongoDB
connectDB();

console.log("🔍 Checking forgot password controller...");
try {
  const forgotPasswordController = require("./controllers/forgotPasswordController");
  console.log("✅ Forgot password controller loaded successfully");
  console.log("📋 Available methods:", Object.keys(forgotPasswordController));
} catch (error) {
  console.error("❌ Error loading forgot password controller:", error);
}
// -------------------- CONFIG --------------------
const PORT = process.env.PORT || 3500;
const app = express();

// -------------------- MIDDLEWARES --------------------
// 1. Custom logger
app.use(logger);

// 2. Handle credentials before CORS
app.use(credentials);

// 3. CORS
app.use(cors(corsOptions));

// 4. Built-in parsers
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  // Prevent caching for all routes
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
// 5. Serve static files
app.use(express.static(path.join(__dirname, "public")));
// app.use(express.static("views"));

// Add this after your other middlewares in server.js
app.use((req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;

  res.json = function (data) {
    console.log(`📤 RESPONSE ${req.method} ${req.url}:`, data);
    return originalJson.call(this, data);
  };

  next();
});

// -------------------- AI CHATBOT ROUTE --------------------
const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
  console.warn("⚠️  GROQ_API_KEY not set. AI Chatbot will not work.");
} else {
  console.log("✅ GROQ_API_KEY loaded. AI Chatbot is available.");
}

async function callGroq(prompt) {
  const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

  // Enhanced system prompt for better formatting
  const systemPrompt = `You are an expert AI assistant. Follow these formatting rules:

FOR CODE/RESPONSES:
1. Use proper markdown formatting
2. For code blocks: \`\`\`language
   code here
   \`\`\`
3. For explanations: Use clear paragraphs with proper spacing
4. Use bullet points for lists
5. Use **bold** for important concepts
6. Use headings (##, ###) for sections
7. Always provide complete, runnable code examples when applicable
8. Include comments in code for clarity
9. After code, provide clear explanations of how it works
10. Use proper indentation and syntax highlighting

EXAMPLE FORMAT:
\`\`\`python
def hello_world():
    # This function prints a greeting
    print("Hello, World!")

# Call the function
hello_world()
\`\`\`

**Explanation:**
- The function \`hello_world()\` is defined to print a greeting
- When called, it outputs "Hello, World!" to the console
- This demonstrates basic function definition and calling in Python

Be helpful, concise, and format your responses professionally.`;

  const payload = {
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 2048, // Increased for better formatted responses
  };

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Groq API error: ${response.status} - ${
          errorData.error?.message || "Unknown error"
        }`,
      );
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Groq API call failed:", error.message);
    throw error;
  }
}
// Chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res
        .status(400)
        .json({ error: 'Missing "prompt" in request body.' });
    }

    console.log(`🤖 Chatbot processing prompt: "${prompt}"`);
    const aiResponse = await callGroq(prompt);

    res.json({
      response: aiResponse,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in /chat endpoint:", error.message);

    let userMessage = "Failed to get AI response. ";

    if (error.message.includes("429")) {
      userMessage += "Rate limit exceeded. Please try again in a moment.";
    } else if (error.message.includes("401")) {
      userMessage += "Invalid API key. Please check your Groq API key.";
    } else {
      userMessage += error.message;
    }

    res.status(500).json({ error: userMessage });
  }
});
// -------------------- PUBLIC ROUTES --------------------
// Landing pages
app.get(["/", "/index", "/index.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "views", "landing-page", "index.html"));
});
app.get(["/forgot-password", "/forgot-password.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login", "forgot-password.html"));
});

app.get(["/about", "/about.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "views/landing-page/about.html"));
});

app.get(["/help", "/help.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "views/landing-page/help.html"));
});

app.get(["/faq", "/faq.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "views/landing-page/faq.html"));
});

app.get(["/developers", "/developers.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "views/contact/developers.html"));
});

app.get(["/contact", "/contact.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "views/contact/contact.html"));
});

// Guides
app.get(["/login-guide", "/login-guide.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "views/landing-page/login-guide.html"));
});
app.get(["/search-guide", "/search-guide.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "views/landing-page/search-guide.html"));
});
app.get(["/borrow-return-guide", "/borrow-return-guide.html"], (req, res) => {
  res.sendFile(
    path.join(__dirname, "views/landing-page/borrow-return-guide.html"),
  );
});
app.get(["/reset-password-guide", "/reset-password-guide.html"], (req, res) => {
  res.sendFile(
    path.join(__dirname, "views/landing-page/reset-password-guide.html"),
  );
});
app.get(
  ["/manage-borrowed-guide", "/manage-borrowed-guide.html"],
  (req, res) => {
    res.sendFile(
      path.join(__dirname, "views/landing-page/manage-borrowed-guide.html"),
    );
  },
);

// Login pages
app.get(
  ["/login", "/login.html", "/login-index", "/login_index.html"],
  (req, res) => {
    res.sendFile(path.join(__dirname, "views/login/login_index.html"));
  },
);

// Student & Librarian dashboards (public only for HTML, API protected separately)
app.get(["/student-dashboard", "/student-dashboard.html"], (req, res) => {
  res.sendFile(
    path.join(__dirname, "views/student-dashboard/student-dashboard.html"),
  );
});
app.get(["/librarian-dashboard", "/librarian-dashboard.html"], (req, res) => {
  res.sendFile(
    path.join(__dirname, "views/librarian-dashboard/librarian-dashboard.html"),
  );
});

// Add book page
app.get(["/addbooks/addbook_lib", "/addbooks/addbook_lib.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "views/addbooks/addbook_lib.html"));
});

app.use((req, res, next) => {
  if (req.path.includes("forgot-password") || req.path.includes("auth")) {
    console.log("🔍 REQUEST DETAILS:", {
      method: req.method,
      path: req.path,
      url: req.url,
      originalUrl: req.originalUrl,
      body: req.body,
    });
  }
  next();
});

// -------------------- AUTH ROUTES --------------------
app.use("/register", require("./routes/register"));
app.use("/auth", require("./routes/auth"));
app.use("/api/auth", require("./routes/auth"));
app.use("/refresh", require("./routes/refresh")); // No JWT required
app.use("/logout", require("./routes/logout")); // No JWT required

app.post("/debug-test-1", (req, res) => {
  console.log("✅ Debug 1: Basic route working");
  res.json({ message: "Basic route working" });
});

app.post("/api/debug-test-2", (req, res) => {
  console.log("✅ Debug 2: API route working");
  res.json({ message: "API route working" });
});

app.post("/api/auth/debug-test-3", (req, res) => {
  console.log("✅ Debug 3: API auth route working");
  res.json({ message: "API auth route working" });
});

// -------------------- PROTECTED API ROUTES --------------------
app.use("/api/students", verifyJWT, require("./routes/api/students"));
app.use("/api/librarian", verifyJWT, require("./routes/api/librarian"));

// -------------------- 404 HANDLER --------------------
app.use((req, res) => {
  res.status(404);
  if (req.accepts("html")) {
    res.sendFile(path.join(__dirname, "views/404.html"));
  } else if (req.accepts("json")) {
    res.json({ error: "404 Not Found" });
  } else {
    res.type("txt").send("404 Not Found");
  }
});

// -------------------- ERROR HANDLER --------------------
app.use(errorHandler);

// -------------------- START SERVER --------------------
mongoose.connection.once("open", () => {
  console.log("connceted to mongo db");
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
