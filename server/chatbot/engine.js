require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ===== Configuration =====
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CONCURRENCY = Number(process.env.CHATBOT_CONCURRENCY) || 2;
const MAX_PROMPT_CHARS = Number(process.env.CHAT_MAX_PROMPT_CHARS) || 4000;

// Initialize Gemini AI client
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// System prompt defining the AI assistant's personality and guidelines
const SYSTEM_PROMPT = `You are BabyStar, a friendly and knowledgeable AI pregnancy companion. Your role is to:

1. Provide helpful, accurate information about pregnancy, baby development, and maternal health
2. Offer emotional support and encouragement to expectant mothers
3. Give practical tips on nutrition, exercise, and wellness during pregnancy
4. Answer questions about symptoms, milestones, and what to expect
5. Remind users to consult healthcare professionals for medical advice

Important guidelines:
- Be warm, supportive, and empathetic
- Use simple, clear language
- Always recommend consulting a doctor for medical concerns
- Never diagnose conditions or prescribe treatments
- Be culturally sensitive
- Keep responses concise but informative (2-3 paragraphs max unless more detail is requested)

If the user asks something unrelated to pregnancy, parenting, or health, politely redirect the conversation or provide a brief helpful response.`;

// ===== Concurrency Queue =====
// Limits simultaneous AI requests to prevent overload
let running = 0;
const queue = [];

// Add a function to the queue
function enqueue(fn) {
    return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        processQueue();
    });
}

// Process queued requests respecting concurrency limit
function processQueue() {
    if (running >= CONCURRENCY) return;
    const item = queue.shift();
    if (!item) return;
    
    running++;
    item.fn()
        .then(result => item.resolve(result))
        .catch(err => item.reject(err))
        .finally(() => {
            running--;
            processQueue();
        });
}

// ===== AI Response Generation =====

// Generate AI response using Gemini API
// {string} prompt - User's message
// {Object} context - Conversation context (previous messages, user info)
// {Promise<string>} - AI response text

async function generateAIResponse(prompt, context = {}) {
    // Validate prompt length
    if (typeof prompt === 'string' && prompt.length > MAX_PROMPT_CHARS) {
        throw new Error('Prompt too long');
    }

    // Check if API is configured
    if (!genAI) {
        return 'Sorry, the AI service is not configured. Please contact support.';
    }

    try {
        // Use gemini-2.5-flash model
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        // Build conversation context from previous messages
        let conversationContext = '';
        if (context.contextMessages && context.contextMessages.length > 0) {
            conversationContext = '\n\nRecent conversation:\n';
            for (const msg of context.contextMessages) {
                const role = msg.role === 'user' ? 'User' : 'Assistant';
                conversationContext += `${role}: ${msg.content}\n`;
            }
        }
        
        // Construct full prompt with system instructions
        const fullPrompt = `${SYSTEM_PROMPT}${conversationContext}\n\nUser: ${prompt}\n\nAssistant:`;
        
        // Call Gemini API
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();
        
        return text.trim();
    } catch (error) {
        console.error('Gemini API error:', error.message);
        
        // Return user-friendly error messages
        if (error.message.includes('API_KEY') || error.message.includes('invalid')) {
            return 'Sorry, there is a configuration issue with the AI service.';
        }
        if (error.message.includes('quota') || error.message.includes('rate') || error.message.includes('429')) {
            return 'Sorry, the AI service is temporarily busy. Please try again in a moment.';
        }
        if (error.message.includes('safety') || error.message.includes('blocked')) {
            return 'Sorry, I cannot respond to that type of message. Please ask something else.';
        }
        
        return 'Sorry, an error occurred. Please try again.';
    }
}

module.exports = {
    enqueue,
    generateAIResponse,
    MAX_PROMPT_CHARS
};
