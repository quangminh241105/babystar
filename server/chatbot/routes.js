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
    // Pagination support for better performance with many conversations
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    
    const conversations = await Conversation.find({ 
      userId, 
      deletedAt: null 
    })
    .sort({ isPinned: -1, lastMessageAt: -1 }) // Pinned first, then by recent
    .skip(skip)
    .limit(limit)
    .select('title topic status lastMessageAt stats createdAt isPinned isBookmarked')
    .lean(); // Use lean() for ~5x faster read-only queries
    
    res.json({ success: true, conversations, page, limit });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ success: false, errors: { general: 'Failed to fetch conversations' }});
  }
});

// GET /chatbot/conversations/:id - get a specific conversation with messages
router.get('/conversations/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    // Support pagination for messages within conversation
    const messageLimit = Math.min(100, parseInt(req.query.messageLimit) || 50);
    const beforeId = req.query.before; // For loading older messages
    
    // Use aggregation for efficient message slicing
    const conversation = await Conversation.findOne({ 
      _id: req.params.id, 
      userId,
      deletedAt: null 
    })
    .lean(); // Lean for faster read
    
    if (!conversation) {
      return res.status(404).json({ success: false, errors: { general: 'Conversation not found' }});
    }
    
    // Filter and limit messages efficiently
    if (conversation.messages) {
      let messages = conversation.messages.filter(m => !m.deletedAt);
      
      // If loading older messages, find the index and slice
      if (beforeId) {
        const beforeIndex = messages.findIndex(m => m._id.toString() === beforeId);
        if (beforeIndex > 0) {
          messages = messages.slice(Math.max(0, beforeIndex - messageLimit), beforeIndex);
        }
      } else {
        // Get most recent messages
        messages = messages.slice(-messageLimit);
      }
      
      conversation.messages = messages;
      conversation.hasMoreMessages = conversation.stats?.messageCount > messageLimit;
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

// PUT /chatbot/conversations/:id/rename - rename a conversation
router.put('/conversations/:id/rename', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { title } = req.body;
    
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ success: false, errors: { title: 'Title is required' }});
    }
    
    const trimmedTitle = title.trim().substring(0, 200); // Max 200 chars
    
    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId, deletedAt: null },
      { title: trimmedTitle },
      { new: true }
    ).select('title');
    
    if (!conversation) {
      return res.status(404).json({ success: false, errors: { general: 'Conversation not found' }});
    }
    
    res.json({ success: true, title: conversation.title });
  } catch (err) {
    console.error('Error renaming conversation:', err);
    res.status(500).json({ success: false, errors: { general: 'Failed to rename conversation' }});
  }
});

// PUT /chatbot/conversations/:id/pin - toggle pin status
router.put('/conversations/:id/pin', requireAuth, async (req, res) => {
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
    
    conversation.isPinned = !conversation.isPinned;
    await conversation.save();
    
    res.json({ success: true, isPinned: conversation.isPinned });
  } catch (err) {
    console.error('Error toggling pin:', err);
    res.status(500).json({ success: false, errors: { general: 'Failed to toggle pin' }});
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

    // Find or create conversation - use lean for context fetch
    let conversation;
    let contextMessages = [];
    const cid = req.body.conversationId;
    
    if (cid) {
      try { 
        // Fetch only what we need for context (last 8 messages)
        const existingConv = await Conversation.findOne(
          { _id: cid, userId },
          { messages: { $slice: -8 }, 'stats': 1 }
        ).lean();
        
        if (existingConv) {
          // Extract context before modifying
          contextMessages = (existingConv.messages || [])
            .filter(m => !m.deletedAt)
            .map(m => ({ role: m.role, content: m.content }));
          conversation = await Conversation.findById(cid);
        }
      } catch (e) { /* ignore invalid id */ }
    }
    
    const isNew = !conversation;
    if (isNew) {
      conversation = new Conversation({ 
        userId, 
        title: text.length > 50 ? text.substring(0, 47) + '...' : text, 
        topic: 'general', 
        messages: [] 
      });
    }

    // Generate AI response (before saving to reduce DB round trips)
    const assistantText = await enqueue(async () => {
      return await generateAIResponse(text, { conversationId: conversation._id, contextMessages, userId });
    });

    // Prepare both messages
    const userMessage = { role: 'user', content: text, contentType: 'text', status: 'sent', createdAt: new Date() };
    const assistantMessage = { role: 'assistant', content: String(assistantText).slice(0, 20000), contentType: 'text', status: 'sent', createdAt: new Date() };
    const now = new Date();

    // Single atomic save with both messages
    conversation.messages.push(userMessage, assistantMessage);
    conversation.stats = conversation.stats || {};
    conversation.stats.messageCount = (conversation.stats.messageCount || 0) + 2;
    conversation.stats.userMessageCount = (conversation.stats.userMessageCount || 0) + 1;
    conversation.stats.assistantMessageCount = (conversation.stats.assistantMessageCount || 0) + 1;
    conversation.lastMessageAt = now;
    conversation.lastUserMessageAt = now;
    conversation.lastAssistantMessageAt = now;
    await conversation.save();

    res.json({ success: true, assistant: assistantText, conversationId: conversation._id, isNewConversation: isNew });
  } catch (err) {
    console.error('Chat error:', err);
    if (err.message === 'Prompt too long') return res.status(413).json({ success: false, errors: { general: 'Prompt too long' }});
    res.status(500).json({ success: false, errors: { general: 'Server error' }});
  }
});

module.exports = router;
