// server.js
const express = require('express');
const OpenAI = require('openai');
const path = require('path');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies and serve static files
app.use(express.json());
app.use(express.static('public'));

// Initialize OpenAI client with xAI configuration
const client = new OpenAI({
    apiKey: "xai-UHMbLDw6bKJHpPdJFln2aexR63Oe8bZ6SG3v2yqS4d92mpcxHSETeMfJKU1ZjnA3WRoIV5HbhsN4qTPs",
    baseURL: "https://api.x.ai/v1",
});

// Serve the HTML frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle chat messages
app.post('/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;

        const completion = await client.chat.completions.create({
            model: "grok-2-latest",
            messages: [
                {
                    role: "system",
                    content: "You are Grok, a chatbot inspired by the Hitchhiker's Guide to the Galaxy.",
                },
                {
                    role: "user",
                    content: userMessage,
                },
            ],
        });

        const response = completion.choices[0].message.content;
        res.json({ response });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
