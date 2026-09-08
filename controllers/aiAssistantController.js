import { logger } from '../utils/logger.js';

/**
 * Multi-agent routing configuration.
 */
const AGENTS = {
  training: { name: 'Training Coach Agent', keywords: ['train', 'exercise', 'workout', 'plan', 'recovery', 'rest', 'sprint', 'run', 'gym', 'warm'] },
  nutrition: { name: 'Nutrition Agent', keywords: ['diet', 'nutrition', 'food', 'protein', 'calories', 'meal', 'supplement', 'eat', 'water', 'carb'] },
  career: { name: 'Career Advisor Agent', keywords: ['opportunity', 'trial', 'job', 'sponsorship', 'career', 'scholarship', 'selection', 'team'] },
  general: { name: 'General Assistant', keywords: [] }
};

/**
 * Feature 7: AI Assistant with Multi-Agent Routing.
 * Proxies message to Member 5's Python FastAPI LLM / LangGraph agent service,
 * with standard multi-agent routing fallback when Python is offline.
 */
export const chat = async (req, res, next) => {
  try {
    const { message = '' } = req.body;
    const athleteName = req.user?.email?.split('@')[0] || 'Athlete';
    const pythonAiUrl = process.env.PYTHON_AI_URL || 'http://localhost:8000';

    // Fetch recent conversation history for multi-turn agent context
    let history = [];
    try {
      const { getDb } = await import('../config/db.js');
      const db = getDb();
      if (db && req.user?.id) {
        const recentChats = await db.collection('chat_history')
          .find({ userId: req.user.id })
          .sort({ createdAt: -1 })
          .limit(4)
          .toArray();
        history = recentChats.reverse().map(c => ({
          role: c.agentType ? 'assistant' : 'user',
          content: c.response || c.userMessage || ''
        }));
      }
    } catch (histErr) {
      logger.warn('Failed to load chat history for context', { error: histErr.message });
    }

    // 1. Try to call Member 5's Python FastAPI AI service
    try {
      const response = await fetch(`${pythonAiUrl}/ai/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(req.headers?.authorization ? { 'Authorization': req.headers.authorization } : {})
        },
        body: JSON.stringify({
          message,
          history,
          userId: req.user?.id || 'anonymous',
          athleteName
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const aiData = await response.json();
        logger.info('Received chat response from Python FastAPI');
        return res.status(200).json({
          success: true,
          source: 'python-fastapi-agent',
          data: aiData
        });
      }
    } catch (aiErr) {
      logger.warn(`Python AI service unreachable at ${pythonAiUrl} (${aiErr.message}), using standard agent fallback`);
    }

    // 2. Fallback routing logic when Python service is offline
    const lowerMsg = message.toLowerCase();
    let selectedAgent = 'general';
    let maxMatches = 0;

    for (const [agentKey, agent] of Object.entries(AGENTS)) {
      const matches = agent.keywords.filter(kw => lowerMsg.includes(kw)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        selectedAgent = agentKey;
      }
    }

    const responses = {
      training: `🏋️ As your Training Coach:\n\n1. Start with dynamic warmup (10 min)\n2. Focus on explosive drills — box jumps, sprint intervals\n3. Include 2 rest days per week for recovery\n4. Track your heart rate zones during training\n5. Progressive overload — increase intensity by 5% weekly`,
      nutrition: `🥗 As your Nutritionist:\n\n• Daily calories: ~3200-3500 kcal\n• Protein: 140-150g/day\n• Pre-workout: Complex carbs 2hrs before\n• Post-workout: Protein shake within 30 min\n• Hydration: 3-4 liters water daily`,
      career: `🎯 As your Career Advisor:\n\n• Check the /matched endpoints for personalized opportunities\n• Apply early — deadlines fill up fast\n• Consider part-time coaching roles for steady income\n• Build your profile with verified achievements`,
      general: `👋 Hi ${athleteName}! I'm your AI assistant. I can help with:\n\n• Training plans & workout advice (ask about exercises)\n• Nutrition & diet guidance (ask about meals)\n• Career opportunities & sponsorships (ask about trials)\n\nWhat would you like to know more about?`
    };

    logger.info(`AI Assistant routed to ${selectedAgent} agent (fallback)`);
    const fallbackResponse = responses[selectedAgent];

    // Persist conversation to MongoDB
    try {
      const { getDb } = await import('../config/db.js');
      const db = getDb();
      if (db && req.user?.id) {
        await db.collection('chat_history').insertOne({
          userId: req.user.id,
          userMessage: message,
          response: fallbackResponse,
          agentType: selectedAgent,
          createdAt: new Date()
        });
      }
    } catch (dbErr) {
      logger.warn('Failed to persist chat message', { error: dbErr.message });
    }

    res.status(200).json({
      success: true,
      source: 'backend-fallback',
      data: {
        userMessage: message,
        routedTo: AGENTS[selectedAgent].name,
        agentType: selectedAgent,
        confidence: maxMatches > 2 ? 'High' : maxMatches > 0 ? 'Medium' : 'Low',
        keywordsMatched: maxMatches,
        response: fallbackResponse
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves chat history for the logged-in user.
 */
export const getChatHistory = async (req, res, next) => {
  try {
    const { getDb } = await import('../config/db.js');
    const db = getDb();
    const history = await db.collection('chat_history')
      .find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();

    res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    next(error);
  }
};

