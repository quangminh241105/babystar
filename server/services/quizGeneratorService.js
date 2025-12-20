const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Quiz } = require('../models/quizzes');

// Initialize Gemini AI with the correct API key and model
const apiKey = process.env.GEMINI_API_KEY_QUIZ;
console.log('🔑 Quiz Generator API Key loaded:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT FOUND');

const genAI = new GoogleGenerativeAI(apiKey);
const modelName = 'gemini-2.5-flash'; // Using stable model
console.log('🤖 Using Gemini model:', modelName);

const model = genAI.getGenerativeModel({ model: modelName });

/**
 * Generate quiz using Gemini AI
 * @param {Object} options - Quiz generation options
 * @param {string} options.category - Category: nutrition, exercise, baby_development
 * @param {number} options.numQuestions - Number of questions to generate (5-15)
 * @param {string} options.difficulty - Difficulty level: easy, medium, hard
 * @returns {Promise<Object>} Generated quiz data
 */
async function generateQuizWithAI({ category, numQuestions = 10, difficulty = 'medium' }) {
  // Map category to readable name
  const categoryNames = {
    nutrition: 'Pregnancy Nutrition',
    exercise: 'Pregnancy Exercise',
    baby_development: 'Baby Development'
  };

  const categoryName = categoryNames[category] || category;

  // Construct detailed prompt for AI
  const prompt = `You are a pregnancy health expert. Generate a quiz about ${categoryName} for pregnant women.

Requirements:
- Generate exactly ${numQuestions} multiple choice questions
- Difficulty level: ${difficulty}
- Each question must have exactly 4 answer options (A, B, C, D)
- Only ONE option should be correct
- Include a brief explanation (2-3 sentences) for the correct answer
- Questions should be practical, accurate, and helpful for pregnant women
- Cover diverse topics within ${categoryName}

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "title": "Quiz title here",
  "description": "Brief quiz description",
  "category": "${category}",
  "questions": [
    {
      "questionText": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Explanation for why this answer is correct."
    }
  ]
}

Important:
- correctAnswer must be the index (0-3) of the correct option
- Options array must have exactly 4 items
- All fields are required
- Make questions engaging and educational`;

  try {
    console.log('🤖 Calling Gemini AI to generate quiz...');
    console.log('📊 Parameters:', { category, numQuestions, difficulty });
    console.log('🔑 Using API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET');
    console.log('🤖 Using Model:', modelName);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Clean up response - remove markdown code blocks if present
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parse JSON
    const quizData = JSON.parse(text);

    // Validate structure
    validateQuizStructure(quizData);

    console.log(`✅ Generated quiz with ${quizData.questions.length} questions`);
    return quizData;

  } catch (error) {
    console.error('❌ Error generating quiz with AI:', error);
    console.error('❌ Error details:', {
      message: error.message,
      status: error.status,
      statusText: error.statusText
    });
    throw new Error(`Failed to generate quiz: ${error.message}`);
  }
}

/**
 * Validate quiz structure before saving to database
 */
function validateQuizStructure(quizData) {
  if (!quizData.title || !quizData.category) {
    throw new Error('Quiz must have title and category');
  }

  if (!Array.isArray(quizData.questions) || quizData.questions.length === 0) {
    throw new Error('Quiz must have at least one question');
  }

  quizData.questions.forEach((q, index) => {
    if (!q.questionText) {
      throw new Error(`Question ${index + 1}: Missing questionText`);
    }

    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`Question ${index + 1}: Must have exactly 4 options`);
    }

    if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
      throw new Error(`Question ${index + 1}: correctAnswer must be 0, 1, 2, or 3`);
    }

    if (!q.explanation) {
      throw new Error(`Question ${index + 1}: Missing explanation`);
    }
  });
}

/**
 * Generate and save quiz to database
 */
async function generateAndSaveQuiz(options) {
  try {
    // Generate quiz using AI
    const quizData = await generateQuizWithAI(options);

    // Check if quiz with same title exists
    const existingQuiz = await Quiz.findOne({ 
      title: quizData.title,
      category: quizData.category 
    });

    if (existingQuiz) {
      // Update existing quiz
      existingQuiz.description = quizData.description;
      existingQuiz.questions = quizData.questions;
      existingQuiz.isActive = true;
      await existingQuiz.save();
      
      console.log(`✅ Updated existing quiz: ${quizData.title}`);
      return { success: true, quiz: existingQuiz, isNew: false };
    } else {
      // Create new quiz
      const quiz = new Quiz({
        title: quizData.title,
        description: quizData.description,
        category: quizData.category,
        questions: quizData.questions,
        isActive: true
      });

      await quiz.save();
      console.log(`✅ Saved new quiz to database: ${quizData.title}`);
      return { success: true, quiz, isNew: true };
    }

  } catch (error) {
    console.error('❌ Error generating and saving quiz:', error);
    throw error;
  }
}

/**
 * Generate quiz questions and add to existing quiz
 */
async function addQuestionsToQuiz(quizId, numQuestions = 5, difficulty = 'medium') {
  try {
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      throw new Error('Quiz not found');
    }

    // Generate new questions
    const quizData = await generateQuizWithAI({
      category: quiz.category,
      numQuestions,
      difficulty
    });

    // Add new questions to existing quiz
    quiz.questions.push(...quizData.questions);
    await quiz.save();

    console.log(`✅ Added ${quizData.questions.length} questions to quiz: ${quiz.title}`);
    return { success: true, quiz, addedQuestions: quizData.questions.length };

  } catch (error) {
    console.error('❌ Error adding questions to quiz:', error);
    throw error;
  }
}

module.exports = {
  generateQuizWithAI,
  generateAndSaveQuiz,
  addQuestionsToQuiz,
  validateQuizStructure
};
