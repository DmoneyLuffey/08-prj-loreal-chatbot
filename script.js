/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");

/* Cloudflare Worker endpoint */
const WORKER_URL = "https://lorealbot-worker.dward127.workers.dev/";

/* Keep chat history so the assistant remembers the conversation */
const messages = [
  {
    role: "system",
    content:
      "You are a L'Oreal beauty assistant. Answer only questions about L'Oreal products, skincare, makeup, haircare, fragrances, routines, and beauty recommendations. If a question is unrelated, politely refuse and guide the user back to L'Oreal beauty topics.",
  },
];

/* Track simple user profile data and past questions */
const userProfile = {
  name: "",
};

const pastQuestions = [];

// Detect common name-introduction patterns like "my name is Ana" or "I am John"
function extractNameFromText(text) {
  const patterns = [
    /my name is\s+([a-zA-Z'-]+)/i,
    /i am\s+([a-zA-Z'-]+)/i,
    /i'm\s+([a-zA-Z'-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const firstLetter = match[1].charAt(0).toUpperCase();
      const rest = match[1].slice(1).toLowerCase();
      return `${firstLetter}${rest}`;
    }
  }

  return "";
}

// Build the messages array that will be sent to the API for this turn
function buildRequestMessages() {
  const requestMessages = [...messages];

  if (userProfile.name) {
    requestMessages.push({
      role: "system",
      content: `The user's name is ${userProfile.name}. Use their name naturally when helpful.`,
    });
  }

  if (pastQuestions.length > 0) {
    const recentQuestions = pastQuestions.slice(-5).join(" | ");
    requestMessages.push({
      role: "system",
      content: `Recent user questions for context: ${recentQuestions}`,
    });
  }

  return requestMessages;
}

// Helper function to show a message in the chat window
function appendMessage(role, text) {
  const msg = document.createElement("div");
  const speaker = role === "user" ? "You" : "Assistant";
  msg.className = `msg ${role === "user" ? "user" : "ai"}`;
  msg.innerHTML = `
    <span class="msg-speaker">${speaker}</span>
    <p class="msg-text">${text}</p>
  `;
  chatWindow.appendChild(msg);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Show a temporary loading message while waiting for the API
function showThinkingMessage() {
  const msg = document.createElement("div");
  msg.className = "msg ai thinking";
  msg.innerHTML = `
    <span class="msg-speaker">Assistant</span>
    <p class="msg-text">Thinking...</p>
  `;
  chatWindow.appendChild(msg);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return msg;
}

// Initial greeting
appendMessage("ai", "Hello! Ask me about L'Oreal products or beauty routines.");

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const question = userInput.value.trim();
  if (!question) return;

  const detectedName = extractNameFromText(question);
  if (detectedName) {
    userProfile.name = detectedName;
  }

  // Keep only the latest visible Q&A while preserving full API context in `messages`
  chatWindow.innerHTML = "";
  appendMessage("user", question);
  messages.push({ role: "user", content: question });
  pastQuestions.push(question);

  userInput.value = "";
  userInput.focus();
  sendBtn.disabled = true;
  const thinkingMessage = showThinkingMessage();

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: buildRequestMessages() }),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    const botReply = data.choices?.[0]?.message?.content;

    if (!botReply) {
      throw new Error("No response content returned from the API.");
    }

    thinkingMessage.remove();
    appendMessage("ai", botReply);
    messages.push({ role: "assistant", content: botReply });
  } catch (error) {
    thinkingMessage.remove();
    appendMessage("ai", "Sorry, I had trouble connecting. Please try again.");
    console.error("Chat request error:", error);
  } finally {
    sendBtn.disabled = false;
  }
});
