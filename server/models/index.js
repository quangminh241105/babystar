/**
 * Models Index
 * Central export for all MongoDB models
 * 
 * Usage:
 *   const { User, HealthLog, WeeklyReport } = require('./models');
 *   // or
 *   const models = require('./models');
 *   const user = await models.User.findById(id);
 */

const User = require('./user');
const HealthLog = require('./healthlogs');
const WeeklyReport = require('./weeklyreports');
const Conversation = require('./aichatbot');
const { Quiz, QuizAttempt } = require('./quizzes');
const Appointment = require('./appointment');
const { Article, UserArticleInteraction } = require('./article');
const { Notification, NotificationPreferences, ScheduledNotification } = require('./notification');
const DietPlan = require('./dietplan');
const ExercisePlan = require('./exerciseplan');

module.exports = {
	// User & Authentication
	User,
	
	// Health Tracking
	HealthLog,
	WeeklyReport,
	DietPlan,
	ExercisePlan,
	
	// AI Chatbot
	Conversation,
	
	// Quizzes & Gamification
	Quiz,
	QuizAttempt,
	
	// Appointments
	Appointment,
	
	// Articles & Content
	Article,
	UserArticleInteraction,
	
	// Notifications
	Notification,
	NotificationPreferences,
	ScheduledNotification
};
