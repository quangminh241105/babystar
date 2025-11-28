/**
 * Chatbot HTTP Routes
 * Handles chat page rendering and message API endpoints
 */

const express = require('express');
const router = express.Router();
const Conversation = require('../models/aichatbot');
const { requireAuth, requireAuthRedirect } = require('../middleware');
const { chatRateLimit } = require('../middleware/rateLimit');
const { enqueue, generateAIResponse, MAX_PROMPT_CHARS } = require('./engine');

// GET /chatbot - render chat page
router.get('/', requireAuthRedirect, (req, res) => {
  res.render('pages/chatbot', { title: 'Chatbot' });
});

// GET /chatbot/debug-session - verify session (for client)
router.get('/debug-session', (req, res) => {
  res.json({
    sessionExists: !!req.session,
    sessionID: req.sessionID,
    sessionUser: req.session?.user || null
  });
});

// GET /chatbot/conversations - get list of user's conversations
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const conversations = await Conversation.find({ 
      userId, 
      deletedAt: null 
    })
    .sort({ lastMessageAt: -1 })
    .limit(50)
    .select('title topic status lastMessageAt stats createdAt');
    
    res.json({ success: true, conversations });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ success: false, errors: { general: 'Failed to fetch conversations' }});
  }
});

// GET /chatbot/conversations/:id - get a specific conversation with messages
router.get('/conversations/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const conversation = await Conversation.findOne({ 
      _id: req.params.id, 
      userId,
      deletedAt: null 
    });
    
    if (!conversation) {
      return res.status(404).json({ success: false, errors: { general: 'Conversation not found' }});
    }
    
    res.json({ success: true, conversation });
  } catch (err) {
    console.error('Error fetching conversation:', err);
    res.status(500).json({ success: false, errors: { general: 'Failed to fetch conversation' }});
  }
});

// DELETE /chatbot/conversations/:id - delete a conversation
router.delete('/conversations/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId },
      { deletedAt: new Date() },
      { new: true }
    );
    
    if (!conversation) {
      return res.status(404).json({ success: false, errors: { general: 'Conversation not found' }});
    }
    
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (err) {
    console.error('Error deleting conversation:', err);
    res.status(500).json({ success: false, errors: { general: 'Failed to delete conversation' }});
  }
});

// POST /chatbot/message - send message and get AI response
router.post('/message', requireAuth, chatRateLimit, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const text = String(req.body.message || '').trim();
    
    // Validate
    if (!text) return res.status(400).json({ success: false, errors: { message: 'Empty message' }});
    if (text.length > MAX_PROMPT_CHARS) return res.status(413).json({ success: false, errors: { message: 'Message too long' }});

    // Find or create conversation
    let conversation;
    const cid = req.body.conversationId;
    if (cid) {
      try { conversation = await Conversation.findOne({ _id: cid, userId }); } catch (e) {}
    }
    if (!conversation) {
      conversation = new Conversation({ userId, title: 'Chat with BabyStar', topic: 'general', messages: [] });
    }

    // Save user message
    conversation.messages.push({ role: 'user', content: text, contentType: 'text', status: 'sent' });
    conversation.stats = conversation.stats || {};
    conversation.stats.messageCount = (conversation.stats.messageCount || 0) + 1;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Generate AI response
    const assistantText = await enqueue(async () => {
      const contextMessages = conversation.getContextMessages?.(8) || [];
      return await generateAIResponse(text, { conversationId: conversation._id, contextMessages, userId });
    });

    // Save AI response
    conversation.messages.push({ role: 'assistant', content: String(assistantText).slice(0, 20000), contentType: 'text', status: 'sent' });
    conversation.stats.messageCount = (conversation.stats.messageCount || 0) + 1;
    conversation.stats.assistantMessageCount = (conversation.stats.assistantMessageCount || 0) + 1;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    res.json({ success: true, assistant: assistantText, conversationId: conversation._id });
  } catch (err) {
    console.error('Chat error:', err);
    if (err.message === 'Prompt too long') return res.status(413).json({ success: false, errors: { general: 'Prompt too long' }});
    res.status(500).json({ success: false, errors: { general: 'Server error' }});
  }
});

module.exports = router;
