const { GoogleGenerativeAI } = require('@google/generative-ai');
const ExerciseDataLoader = require('./exerciseDataLoader');

// Global singleton for exercise loader (reuse across requests)
let sharedExerciseLoader = null;

class ExerciseSuggestionService {
	constructor() {
		this.apiKey = process.env.GEMINI_API_KEY_EXERCISE_SUGGESTIONS;
		if (!this.apiKey) {
			throw new Error('GEMINI_API_KEY_EXERCISE_SUGGESTIONS not found in environment variables');
		}

		this.genAI = new GoogleGenerativeAI(this.apiKey);
		this.model = this.genAI.getGenerativeModel({ 
			model: 'gemini-2.0-flash',
			generationConfig: {
				maxOutputTokens: 8192,  // Increased to handle full 7-day plan
				temperature: 0.7,
				responseMimeType: 'application/json'  // Force JSON output
			}
		});
		
		// Reuse shared loader instance
		if (!sharedExerciseLoader) {
			sharedExerciseLoader = new ExerciseDataLoader();
		}
		this.exerciseLoader = sharedExerciseLoader;
	}

	/**
	 * Initialize the service by loading exercise data (cached)
	 */
	async initialize() {
		// Data loader handles caching internally
		await this.exerciseLoader.loadExerciseData();
	}

	/**
	 * Extract health summary from logs for exercise planning
	 */
	extractHealthSummary(healthLogs) {
		if (!healthLogs || healthLogs.length === 0) {
			return {
				averageEnergy: null,
				commonSymptoms: [],
				currentExercises: [],
				totalExerciseMinutes: 0,
				exerciseDaysCount: 0
			};
		}

		// Energy levels
		const energyLevels = healthLogs.map(l => l.energyLevel).filter(e => e != null);
		const avgEnergy = energyLevels.length > 0 
			? energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length 
			: null;

		// Symptoms
		const symptomCounts = {};
		healthLogs.forEach(log => {
			log.symptoms?.forEach(s => {
				symptomCounts[s.symptom] = (symptomCounts[s.symptom] || 0) + 1;
			});
		});
		const commonSymptoms = Object.entries(symptomCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([symptom, count]) => ({ symptom, count }));

		// Current exercise activities
		let totalExerciseMinutes = 0;
		let exerciseDaysCount = 0;
		const exerciseTypes = {};

		healthLogs.forEach(log => {
			if (log.exercises?.length > 0) {
				exerciseDaysCount++;
				log.exercises.forEach(ex => {
					totalExerciseMinutes += ex.durationMinutes || 0;
					exerciseTypes[ex.type] = (exerciseTypes[ex.type] || 0) + 1;
				});
			}
		});

		const currentExercises = Object.entries(exerciseTypes)
			.sort((a, b) => b[1] - a[1])
			.map(([type, count]) => ({ type, count }));

		return {
			averageEnergy: avgEnergy ? avgEnergy.toFixed(1) : null,
			commonSymptoms,
			currentExercises,
			totalExerciseMinutes,
			exerciseDaysCount
		};
	}

	/**
	 * Get trimester-specific exercise goals and guidelines
	 */
	getExerciseGoalsByTrimester(trimester, pregnancyWeek) {
		const goals = {
			1: {
				totalMinutes: 150,
				daysPerWeek: 4,
				intensityLevel: "moderate",
				focusAreas: ["cardiovascular health", "pelvic floor strength", "flexibility"],
				description: "Build a foundation of fitness while managing early pregnancy symptoms",
				benefits: "Regular exercise in the first trimester can help reduce nausea, improve energy levels, and establish healthy habits for pregnancy.",
				cautionNote: "Listen to your body - fatigue is common. Rest when needed."
			},
			2: {
				totalMinutes: 150,
				daysPerWeek: 5,
				intensityLevel: "moderate",
				focusAreas: ["core stability", "cardiovascular health", "strength training", "pelvic floor"],
				description: "Maintain fitness and prepare your body for the physical demands of later pregnancy",
				benefits: "Exercise in the second trimester can help reduce back pain, prevent excess weight gain, improve sleep quality, and boost your mood and energy.",
				cautionNote: "Avoid exercises lying flat on back after 20 weeks. Stay well hydrated."
			},
			3: {
				totalMinutes: 120,
				daysPerWeek: 4,
				intensityLevel: "light to moderate",
				focusAreas: ["pelvic floor strength", "breathing exercises", "gentle stretching", "labor preparation"],
				description: "Focus on mobility, pelvic floor strength, and preparation for labor and delivery",
				benefits: "Exercise in the third trimester can help prepare your body for labor, reduce swelling, improve posture, and maintain stamina for delivery.",
				cautionNote: "Reduce intensity as needed. Focus on comfort and breathing. Avoid overheating."
			}
		};

		return goals[trimester] || goals[2];
	}

	/**
	 * Build AI prompt for exercise recommendations
	 */
	buildExercisePrompt(pregnancyWeek, trimester, healthSummary, exerciseContext, weeklyReport) {
		const { trimesterExercises, exercisesToAvoid, weeklyGuidance } = exerciseContext;

		// Get trimester-specific goals
		const exerciseGoals = this.getExerciseGoalsByTrimester(trimester, pregnancyWeek);

		// Weekly context from report
		let weeklyWeight = 'N/A';
		let weeklySymptoms = 'None reported';
		let weeklyEnergy = 'N/A';
		
		if (weeklyReport?.summary) {
			weeklyWeight = weeklyReport.summary.endWeightKg ? `${weeklyReport.summary.endWeightKg}kg` : 'N/A';
			weeklyEnergy = weeklyReport.summary.avgEnergyLevel ? `${weeklyReport.summary.avgEnergyLevel}/5` : 'N/A';
			if (weeklyReport.summary.keySymptoms?.length > 0) {
				weeklySymptoms = weeklyReport.summary.keySymptoms.slice(0, 5).join(', ');
			}
		}

		// Format exercises from database for reference
		const recommendedExercises = trimesterExercises.slice(0, 15).map(ex => {
			const name = ex.Exercise || ex.exercise || 'Unknown';
			const category = ex.Category || ex.category || 'General';
			const benefits = ex.Benefits || ex.benefits || '';
			return `- ${name} (${category})${benefits ? `: ${benefits}` : ''}`;
		}).join('\n');

		const avoidExercises = exercisesToAvoid.slice(0, 10).map(ex => {
			const name = ex.Exercise || ex.exercise || 'Unknown';
			const reason = ex.Reason || ex.reason || 'Not safe during pregnancy';
			return `- ${name}: ${reason}`;
		}).join('\n');

		// Weekly guidance if available
		let weeklyGuide = '';
		if (weeklyGuidance) {
			weeklyGuide = `\n**Week ${pregnancyWeek} Guidance:**\n${JSON.stringify(weeklyGuidance, null, 2)}`;
		}

		return `You are a certified prenatal fitness expert. Generate a personalized 7-day pregnancy exercise plan.

**PATIENT PROFILE:**
- Pregnancy Week: ${pregnancyWeek} (Trimester ${trimester})
- Current Weight: ${weeklyWeight}
- Average Energy Level: ${weeklyEnergy}
- Symptoms: ${weeklySymptoms}
- Common Symptoms from Logs: ${healthSummary.commonSymptoms.map(s => s.symptom).join(', ') || 'None'}
- Current Exercise Activity: ${healthSummary.totalExerciseMinutes} minutes/week over ${healthSummary.exerciseDaysCount} days
- Recent Exercises: ${healthSummary.currentExercises.map(e => `${e.type} (${e.count}x)`).join(', ') || 'None logged'}

**TRIMESTER ${trimester} EXERCISE GOALS:**
- Target: ${exerciseGoals.totalMinutes} minutes per week over ${exerciseGoals.daysPerWeek} days
- Intensity: ${exerciseGoals.intensityLevel}
- Focus Areas: ${exerciseGoals.focusAreas.join(', ')}
- Goal: ${exerciseGoals.description}
${weeklyGuide}

**RECOMMENDED EXERCISES FOR TRIMESTER ${trimester}:**
${recommendedExercises}

**EXERCISES TO AVOID:**
${avoidExercises}

**INSTRUCTIONS:**
Create a detailed, safe, and personalized 7-day exercise plan. Consider the patient's:
- Pregnancy week and trimester-specific needs
- Energy levels and symptoms (adjust intensity accordingly)
- Current exercise habits (build gradually, don't over-prescribe)
- Safety first - include modifications and warning signs

**CRITICAL: Return ONLY valid JSON. Do NOT include markdown code blocks. Do NOT include any text before or after the JSON. All text fields must be on a single line (no newlines within strings).**

Example format:

{
  "summary": {
    "planReason": "Based on your week 12 pregnancy and low energy levels with nausea, this plan focuses on gentle movements to maintain fitness without overexertion.",
    "keyBenefits": ["Reduces back pain", "Improves circulation", "Prepares body for labor", "Boosts mood and energy"],
    "weeklyFocus": "Building foundational strength and cardiovascular endurance while respecting your current symptoms"
  },
  "dailyExercisePlan": [
    {
      "day": "Monday",
      "exercises": [
        {
          "name": "Walking",
          "category": "Cardio",
          "duration": "20min",
          "sets": null,
          "reps": null,
          "instructions": "Walk at a comfortable pace on a flat surface. Maintain good posture with shoulders back. Stop if you feel dizzy or short of breath.",
          "modifications": "If tired, reduce to 10-15 minutes or split into two sessions.",
          "targetAreas": ["cardiovascular", "legs"],
          "intensity": "low"
        }
      ],
      "totalDuration": "20min",
      "restDay": false
    },
    {
      "day": "Tuesday",
      "exercises": [],
      "totalDuration": "0min",
      "restDay": true
    }
  ],
  "weeklyGoals": {
    "totalMinutes": ${exerciseGoals.totalMinutes},
    "daysPerWeek": ${exerciseGoals.daysPerWeek},
    "intensityLevel": "${exerciseGoals.intensityLevel}",
    "focusAreas": ${JSON.stringify(exerciseGoals.focusAreas)},
    "description": "${exerciseGoals.description}",
    "benefits": "${exerciseGoals.benefits}",
    "cautionNote": "${exerciseGoals.cautionNote}"
  },
  "safetyGuidelines": [
    "Consult your doctor before starting any exercise program",
    "Stop immediately if you experience pain or dizziness"
  ],
  "exercisesToAvoid": [
    "Contact sports",
    "Heavy weightlifting"
  ]
}

**IMPORTANT REQUIREMENTS:**
1. MUST include "summary" object with planReason, keyBenefits array, and weeklyFocus
2. Generate exercises for ALL 7 days (Monday-Sunday)
3. Include ONLY 1-2 rest days per week - THIS MEANS 5-6 DAYS MUST HAVE EXERCISES
4. Each exercise must have detailed instructions (minimum 2-3 sentences on ONE line)
5. Include practical modifications for when energy is low
6. Target areas must be specific (e.g., "pelvic floor", "lower back", "legs")
7. Total weekly minutes should be 120-150 for low energy, 150-180 for moderate energy
8. Intensity should be "low" or "moderate" only - NO "high" intensity
9. Focus on trimester ${trimester}-appropriate exercises
10. Consider symptoms: ${weeklySymptoms} - adjust plan accordingly
11. Build on current activity level (currently ${healthSummary.totalExerciseMinutes}min/week)
12. CRITICAL: Do NOT make all days rest days - minimum 5 active days required
13. Even with low energy or symptoms, gentle walking and pelvic floor exercises are safe

Generate the plan now:`;
	}

	/**
	 * Generate personalized exercise suggestions using AI
	 */
	async generateExerciseSuggestions(userData) {
		try {
			await this.initialize();

			const {
				userId,
				pregnancyWeek,
				trimester,
				healthLogs,
				weeklyReport
			} = userData;

			// Extract health summary
			const healthSummary = this.extractHealthSummary(healthLogs);

			// Get exercise context from dataset
			const exerciseContext = this.exerciseLoader.getExerciseContext(trimester, pregnancyWeek);

			// Build prompt
			const prompt = this.buildExercisePrompt(
				pregnancyWeek,
				trimester,
				healthSummary,
				exerciseContext,
				weeklyReport
			);

			console.log('🏃 Generating AI exercise suggestions...');

			// Generate content using Gemini
			const result = await this.model.generateContent(prompt);
			const response = await result.response;
			const text = response.text();

			// Parse AI response
			const exercisePlan = this.parseAIResponse(text);

			// Validate plan has actual exercises
			const activeDays = exercisePlan.dailyExercisePlan?.filter(day => 
				!day.restDay && day.exercises?.length > 0
			).length || 0;

			if (activeDays === 0) {
				console.warn('⚠️ AI generated all rest days, using default safe plan');
				return this.getDefaultSafePlan(trimester, pregnancyWeek);
			}

			console.log('✅ AI exercise suggestions generated successfully');

			return exercisePlan;
		} catch (error) {
			console.error('❌ Error generating exercise suggestions:', error);
			throw error;
		}
	}

	/**
	 * Parse AI response and ensure it matches the expected format
	 */
	parseAIResponse(text) {
		try {
			// Remove markdown code blocks if present
			let cleanText = text.trim();
			if (cleanText.startsWith('```json')) {
				cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
			} else if (cleanText.startsWith('```')) {
				cleanText = cleanText.replace(/```\n?/g, '');
			}

			// Fix common JSON issues from AI
			// 1. Replace unescaped newlines in string values with spaces
			cleanText = cleanText.replace(/("(?:instructions|modifications|benefits)":\s*")([^"]*?)"/gs, (match, prefix, content) => {
				// Replace literal newlines with spaces, preserve escaped ones
				const fixed = content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
				return prefix + fixed + '"';
			});

			// 2. Fix truncated JSON - attempt to close incomplete structures
			if (!cleanText.endsWith('}')) {
				console.warn('⚠️ JSON appears truncated, attempting to fix...');
				cleanText = this.attemptFixTruncatedJson(cleanText);
			}

			const parsed = JSON.parse(cleanText);

			// Validate structure
			if (!parsed.dailyExercisePlan || !Array.isArray(parsed.dailyExercisePlan)) {
				throw new Error('Invalid response structure: missing dailyExercisePlan');
			}

			// Ensure we have 7 days
			if (parsed.dailyExercisePlan.length !== 7) {
				console.warn(`⚠️ Expected 7 days, got ${parsed.dailyExercisePlan.length}`);
			}

			return parsed;
		} catch (error) {
			console.error('❌ Error parsing AI response:', error);
			console.error('Raw response:', text.substring(0, 1000));
			throw new Error('Failed to parse AI exercise response');
		}
	}

	/**
	 * Attempt to fix truncated JSON by closing open structures
	 */
	attemptFixTruncatedJson(text) {
		// Count open brackets/braces
		let openBraces = 0;
		let openBrackets = 0;
		let inString = false;
		let escape = false;

		for (const char of text) {
			if (escape) {
				escape = false;
				continue;
			}
			if (char === '\\') {
				escape = true;
				continue;
			}
			if (char === '"') {
				inString = !inString;
				continue;
			}
			if (!inString) {
				if (char === '{') openBraces++;
				else if (char === '}') openBraces--;
				else if (char === '[') openBrackets++;
				else if (char === ']') openBrackets--;
			}
		}

		// If we're in a string, close it
		if (inString) {
			text += '"';
		}

		// Remove incomplete property (like "sets": nul)
		text = text.replace(/,\s*"[^"]+"\s*:\s*[^,}\]]*$/, '');
		text = text.replace(/,\s*$/, '');

		// Close arrays and objects
		while (openBrackets > 0) {
			text += ']';
			openBrackets--;
		}
		while (openBraces > 0) {
			text += '}';
			openBraces--;
		}

		return text;
	}

	/**
	 * Get default safe exercise plan if AI fails
	 */
	getDefaultSafePlan(trimester, pregnancyWeek) {
		const exerciseGoals = this.getExerciseGoalsByTrimester(trimester, pregnancyWeek);
		
		return {
			summary: {
				planReason: `Safe, evidence-based exercise plan for week ${pregnancyWeek} of your pregnancy (Trimester ${trimester})`,
				keyBenefits: ["Improves cardiovascular health", "Strengthens pelvic floor", "Reduces back pain", "Prepares body for labor"],
				weeklyFocus: exerciseGoals.description
			},
			dailyExercisePlan: [
				{
					day: "Monday",
					exercises: [
						{
							name: "Gentle Walking",
							category: "Cardio",
							duration: "20min",
							sets: null,
							reps: null,
							instructions: "Walk at a comfortable pace on flat terrain. Maintain good posture and breathe naturally. Stop if you feel dizzy or overly tired.",
							modifications: "Reduce to 10-15 minutes if energy is low. Take breaks as needed.",
							targetAreas: ["cardiovascular", "legs"],
							intensity: "low"
						},
						{
							name: "Pelvic Floor Exercises",
							category: "Pelvic Floor",
							duration: "10min",
							sets: 3,
							reps: 10,
							instructions: "Contract pelvic floor muscles as if stopping urine flow. Hold for 5 seconds then relax. Breathe normally throughout.",
							modifications: "Start with 3-second holds if new to these exercises.",
							targetAreas: ["pelvic floor"],
							intensity: "low"
						}
					],
					totalDuration: "30min",
					restDay: false
				},
				{
					day: "Tuesday",
					exercises: [
						{
							name: "Prenatal Stretching",
							category: "Flexibility",
							duration: "15min",
							sets: null,
							reps: null,
							instructions: "Gentle full-body stretches focusing on tight areas. Hold each stretch 15-30 seconds without bouncing. Never stretch to pain.",
							modifications: "Use a chair or wall for support if needed.",
							targetAreas: ["full body", "flexibility"],
							intensity: "low"
						}
					],
					totalDuration: "15min",
					restDay: false
				},
				{
					day: "Wednesday",
					exercises: [
						{
							name: "Walking",
							category: "Cardio",
							duration: "25min",
							sets: null,
							reps: null,
							instructions: "Moderate-paced walk maintaining conversational breathing. Use supportive footwear and stay hydrated.",
							modifications: "Split into two 12-minute sessions if needed.",
							targetAreas: ["cardiovascular", "legs"],
							intensity: "moderate"
						},
						{
							name: "Cat-Cow Stretch",
							category: "Core",
							duration: "10min",
							sets: 3,
							reps: 10,
							instructions: "On hands and knees, alternate arching and rounding your back slowly. Helps relieve back tension and improves spine flexibility.",
							modifications: "Use cushion under knees for comfort.",
							targetAreas: ["lower back", "core"],
							intensity: "low"
						}
					],
					totalDuration: "35min",
					restDay: false
				},
				{
					day: "Thursday",
					exercises: [],
					totalDuration: "0min",
					restDay: true
				},
				{
					day: "Friday",
					exercises: [
						{
							name: "Gentle Walking",
							category: "Cardio",
							duration: "20min",
							sets: null,
							reps: null,
							instructions: "Easy-paced walk on flat surface. Focus on posture and breathing. Avoid overheating.",
							modifications: "Reduce duration if feeling fatigued.",
							targetAreas: ["cardiovascular"],
							intensity: "low"
						},
						{
							name: "Pelvic Floor Exercises",
							category: "Pelvic Floor",
							duration: "10min",
							sets: 3,
							reps: 10,
							instructions: "Practice pelvic floor contractions in different positions - sitting, standing, lying down.",
							modifications: "Focus on quality over quantity.",
							targetAreas: ["pelvic floor"],
							intensity: "low"
						}
					],
					totalDuration: "30min",
					restDay: false
				},
				{
					day: "Saturday",
					exercises: [
						{
							name: "Prenatal Yoga",
							category: "Flexibility",
							duration: "20min",
							sets: null,
							reps: null,
							instructions: "Gentle yoga poses safe for pregnancy. Avoid lying flat on back. Use props for support. Focus on breathing and relaxation.",
							modifications: "Skip any poses that feel uncomfortable.",
							targetAreas: ["flexibility", "core", "balance"],
							intensity: "low"
						}
					],
					totalDuration: "20min",
					restDay: false
				},
				{
					day: "Sunday",
					exercises: [],
					totalDuration: "0min",
					restDay: true
				}
			],
			weeklyGoals: {
				totalMinutes: exerciseGoals.totalMinutes,
				daysPerWeek: exerciseGoals.daysPerWeek,
				intensityLevel: exerciseGoals.intensityLevel,
				focusAreas: exerciseGoals.focusAreas,
				description: exerciseGoals.description,
				benefits: exerciseGoals.benefits,
				cautionNote: exerciseGoals.cautionNote
			},
			safetyGuidelines: [
				"Consult your doctor before starting any exercise program",
				"Stop immediately if you experience pain, dizziness, or shortness of breath",
				"Stay hydrated - drink water before, during, and after exercise",
				"Avoid overheating - exercise in cool environments",
				"Never exercise to exhaustion",
				"Avoid lying flat on back after 20 weeks",
				"Listen to your body and rest when needed"
			],
			exercisesToAvoid: [
				"Contact sports",
				"Activities with fall risk",
				"Heavy weightlifting",
				"Exercises lying flat on back after 20 weeks",
				"Hot yoga or overheating activities"
			]
		};
	}
}

module.exports = ExerciseSuggestionService;
