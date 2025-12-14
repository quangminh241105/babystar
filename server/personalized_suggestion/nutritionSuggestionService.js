const { GoogleGenerativeAI } = require('@google/generative-ai');
const NutritionDataLoader = require('./nutritionDataLoader');

/**
 * RAG-based Nutrition Suggestion Service
 * Uses Retrieval-Augmented Generation to provide personalized nutrition advice
 */
class NutritionSuggestionService {
	constructor() {
		this.apiKey = process.env.GEMINI_API_KEY_NUTRITION_SUGGESTIONS;
		if (!this.apiKey) {
			throw new Error('GEMINI_API_KEY_NUTRITION_SUGGESTIONS not found in environment variables');
		}

		this.genAI = new GoogleGenerativeAI(this.apiKey);
		this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
		this.nutritionLoader = new NutritionDataLoader();
		this.dataLoaded = false;
	}

	/**
	 * Initialize the service by loading nutrition data
	 */
	async initialize() {
		if (!this.dataLoaded) {
			await this.nutritionLoader.loadNutritionData();
			this.dataLoaded = true;
		}
	}

	/**
	 * Extract health log summary from weekly data
	 */
	extractHealthLogSummary(healthLogs) {
		if (!healthLogs || healthLogs.length === 0) {
			return {
				averageNutrition: null,
				commonSymptoms: [],
				energyLevels: [],
				hydration: [],
				foodIntake: []
			};
		}

		// Aggregate nutrition data
		let totalCalories = 0;
		let totalProtein = 0;
		let totalCarbs = 0;
		let totalFat = 0;
		let nutritionDays = 0;

		const symptoms = [];
		const energyLevels = [];
		const hydrationData = [];
		const allFoods = [];

		healthLogs.forEach(log => {
			// Nutrition from food intake
			if (log.foodIntake && log.foodIntake.length > 0) {
				log.foodIntake.forEach(meal => {
					if (meal.foods && meal.foods.length > 0) {
						meal.foods.forEach(food => {
							if (food.calories) totalCalories += food.calories;
							if (food.protein) totalProtein += food.protein;
							if (food.carbs) totalCarbs += food.carbs;
							if (food.fat) totalFat += food.fat;
							
							allFoods.push({
								name: food.name,
								category: food.category,
								mealType: meal.mealType,
								calories: food.calories || 0
							});
						});
						nutritionDays++;
					}
				});
			}

			// Symptoms
			if (log.symptoms && log.symptoms.length > 0) {
				log.symptoms.forEach(s => {
					symptoms.push({
						symptom: s.symptom,
						severity: s.severity,
						date: log.logDate
					});
				});
			}

			// Energy levels
			if (log.energyLevel) {
				energyLevels.push(log.energyLevel);
			}

			// Hydration
			if (log.hydration && log.hydration.waterLiters) {
				hydrationData.push(log.hydration.waterLiters);
			}
		});

		// Calculate averages
		const avgCalories = nutritionDays > 0 ? Math.round(totalCalories / nutritionDays) : 0;
		const avgProtein = nutritionDays > 0 ? Math.round(totalProtein / nutritionDays) : 0;
		const avgCarbs = nutritionDays > 0 ? Math.round(totalCarbs / nutritionDays) : 0;
		const avgFat = nutritionDays > 0 ? Math.round(totalFat / nutritionDays) : 0;
		const avgEnergy = energyLevels.length > 0 
			? (energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length).toFixed(1)
			: 0;
		const avgHydration = hydrationData.length > 0
			? (hydrationData.reduce((a, b) => a + b, 0) / hydrationData.length).toFixed(1)
			: 0;

		// Get most common symptoms
		const symptomCounts = {};
		symptoms.forEach(s => {
			symptomCounts[s.symptom] = (symptomCounts[s.symptom] || 0) + 1;
		});
		const commonSymptoms = Object.entries(symptomCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([symptom, count]) => ({ symptom, count }));

		// Get food categories eaten
		const categoryCounts = {};
		allFoods.forEach(f => {
			if (f.category) {
				categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;
			}
		});

		return {
			averageNutrition: {
				calories: avgCalories,
				protein: avgProtein,
				carbs: avgCarbs,
				fat: avgFat
			},
			commonSymptoms,
			averageEnergy: avgEnergy,
			averageHydration: avgHydration,
			foodCategories: categoryCounts,
			totalFoodsLogged: allFoods.length,
			daysWithNutritionData: nutritionDays
		};
	}

	/**
	 * Build RAG context from nutrition dataset based on user needs
	 */
	buildRAGContext(pregnancyWeek, trimester, healthSummary) {
		const nutrientContext = this.nutritionLoader.getNutrientRecommendationsContext();
		
		// Identify nutritional needs based on pregnancy stage and symptoms
		const needs = this.identifyNutritionalNeeds(pregnancyWeek, trimester, healthSummary);

		// Get relevant foods from dataset
		const relevantFoods = {
			iron: this.nutritionLoader.getIronRichFoods(15),
			calcium: this.nutritionLoader.getCalciumRichFoods(15),
			protein: this.nutritionLoader.getHighProteinFoods(15),
			folicAcid: this.nutritionLoader.getFolicAcidRichFoods(15)
		};

		return {
			nutrientContext,
			relevantFoods,
			identifiedNeeds: needs
		};
	}

	/**
	 * Identify nutritional needs based on pregnancy stage and health data
	 */
	identifyNutritionalNeeds(pregnancyWeek, trimester, healthSummary) {
		const needs = [];

		// Trimester-specific needs
		if (trimester === 1) {
			needs.push('Folic acid for neural tube development');
			needs.push('Vitamin B6 for nausea management');
			needs.push('Small frequent meals for morning sickness');
		} else if (trimester === 2) {
			needs.push('Iron for increased blood volume');
			needs.push('Calcium for bone development');
			needs.push('Omega-3 for brain development');
			needs.push('Increased protein for fetal growth');
		} else if (trimester === 3) {
			needs.push('High calcium for bone strengthening');
			needs.push('Iron for preventing anemia');
			needs.push('Fiber for digestive health');
			needs.push('Adequate hydration to prevent swelling');
		}

		// Symptom-based needs
		if (healthSummary.commonSymptoms) {
			healthSummary.commonSymptoms.forEach(({ symptom }) => {
				if (symptom.includes('nausea') || symptom === 'morning_sickness') {
					needs.push('Ginger and vitamin B6 rich foods');
					needs.push('Light, easily digestible foods');
				}
				if (symptom.includes('constipation')) {
					needs.push('High fiber foods and increased hydration');
				}
				if (symptom.includes('fatigue')) {
					needs.push('Iron-rich foods and complex carbohydrates');
				}
				if (symptom.includes('leg_cramps')) {
					needs.push('Magnesium and potassium rich foods');
				}
				if (symptom.includes('heartburn')) {
					needs.push('Small frequent meals, avoid spicy/acidic foods');
				}
			});
		}

		// Energy level based needs
		if (healthSummary.averageEnergy < 3) {
			needs.push('Energy-boosting foods with complex carbs and protein');
		}

		// Hydration needs
		if (healthSummary.averageHydration < 2) {
			needs.push('Increase water intake and hydrating foods');
		}

		return [...new Set(needs)]; // Remove duplicates
	}

	/**
	 * Generate personalized nutrition suggestions using AI
	 */
	async generateNutritionSuggestions(userData) {
		try {
			await this.initialize();

			const {
				userId,
				pregnancyWeek,
				trimester,
				healthLogs,
				dueDate,
				userProfile
			} = userData;

			// Extract health summary
			const healthSummary = this.extractHealthLogSummary(healthLogs);

			// Build RAG context
			const ragContext = this.buildRAGContext(pregnancyWeek, trimester, healthSummary);

			// Build comprehensive prompt
			const prompt = this.buildNutritionPrompt(
				pregnancyWeek,
				trimester,
				healthSummary,
				ragContext,
				userProfile
			);

			console.log('🤖 Generating AI nutrition suggestions...');

			// Generate content using Gemini
			const result = await this.model.generateContent(prompt);
			const response = await result.response;
			const text = response.text();

			// Parse AI response
			const nutritionPlan = this.parseAIResponse(text);

			console.log('✅ AI nutrition suggestions generated successfully');

			return nutritionPlan;
		} catch (error) {
			console.error('❌ Error generating nutrition suggestions:', error);
			throw error;
		}
	}

	/**
	 * Build comprehensive prompt for AI
	 */
	buildNutritionPrompt(pregnancyWeek, trimester, healthSummary, ragContext, userProfile) {
		const { nutrientContext, relevantFoods, identifiedNeeds } = ragContext;

		return `You are an expert pregnancy nutritionist AI. Generate a comprehensive, personalized weekly nutrition plan for a pregnant woman.

**PATIENT INFORMATION:**
- Pregnancy Week: ${pregnancyWeek}
- Trimester: ${trimester}
- Current Average Daily Intake:
  * Calories: ${healthSummary.averageNutrition?.calories || 'Not tracked'} kcal
  * Protein: ${healthSummary.averageNutrition?.protein || 'Not tracked'} g
  * Carbs: ${healthSummary.averageNutrition?.carbs || 'Not tracked'} g
  * Fat: ${healthSummary.averageNutrition?.fat || 'Not tracked'} g
- Average Hydration: ${healthSummary.averageHydration || 'Not tracked'} liters/day
- Average Energy Level: ${healthSummary.averageEnergy || 'Not tracked'}/5
- Common Symptoms: ${healthSummary.commonSymptoms.map(s => s.symptom).join(', ') || 'None reported'}

**IDENTIFIED NUTRITIONAL NEEDS:**
${identifiedNeeds.map(need => `- ${need}`).join('\n')}

**AVAILABLE NUTRIENT-RICH FOODS FROM DATABASE:**

**High-Iron Foods:**
${relevantFoods.iron.map(f => `- ${f.food}: ${f.iron}mg iron, ${f.calories} cal, ${f.protein}g protein`).slice(0, 10).join('\n')}

**High-Calcium Foods:**
${relevantFoods.calcium.map(f => `- ${f.food}: ${f.calcium}mg calcium, ${f.calories} cal`).slice(0, 10).join('\n')}

**High-Protein Foods:**
${relevantFoods.protein.map(f => `- ${f.food}: ${f.protein}g protein, ${f.calories} cal`).slice(0, 10).join('\n')}

**Folic Acid Rich Foods:**
${relevantFoods.folicAcid.map(f => `- ${f.food}: ${f.folicAcid}mcg folic acid, ${f.calories} cal`).slice(0, 10).join('\n')}

**INSTRUCTIONS:**
Generate a complete weekly nutrition plan in the following JSON format. Use ONLY foods from the database provided above or common pregnancy-safe foods. Be specific and practical.

Return ONLY valid JSON (no markdown, no code blocks, no explanations):

{
  "dailyMealRecommendations": [
    {
      "day": "Monday",
      "breakfast": {
        "meal": "Specific meal description",
        "alternatives": ["Alternative 1", "Alternative 2"],
        "estimatedCalories": 350
      },
      "lunch": {
        "meal": "Specific meal description",
        "alternatives": ["Alternative 1", "Alternative 2"],
        "estimatedCalories": 500
      },
      "dinner": {
        "meal": "Specific meal description",
        "alternatives": ["Alternative 1", "Alternative 2"],
        "estimatedCalories": 550
      },
      "snacks": [
        {
          "name": "Snack name",
          "time": "Mid-morning",
          "estimatedCalories": 150
        }
      ]
    }
  ],
  "nutrientFocus": ["Iron", "Calcium", "Folic Acid", "Protein", "Omega-3"],
  "foodsToAvoid": ["Raw fish", "Unpasteurized cheese", "Deli meats", "High mercury fish"],
  "dailyTargets": {
    "calories": 2200,
    "proteinGrams": 75,
    "calciumMg": 1000,
    "ironMg": 27,
    "folicAcidMcg": 600,
    "omega3Grams": 1.4,
    "fiberGrams": 28
  },
  "recommendedFoods": [
    {
      "nutrient": "Iron",
      "foods": ["Food from database 1", "Food from database 2"]
    }
  ],
  "mealPrepTips": ["Tip 1", "Tip 2", "Tip 3"],
  "hydrationGoals": {
    "dailyWaterLiters": 2.5,
    "tips": ["Tip 1", "Tip 2"]
  },
  "supplementsNeeded": ["Prenatal vitamin", "Vitamin D if needed"],
  "specialConsiderations": ["Consideration 1 based on symptoms", "Consideration 2"]
}

Generate all 7 days (Monday through Sunday) with varied, nutritious meals using the foods from the database. Ensure meals are practical, culturally appropriate, and address the identified nutritional needs.`;
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

			const parsed = JSON.parse(cleanText);

			// Validate structure
			if (!parsed.dailyMealRecommendations || !Array.isArray(parsed.dailyMealRecommendations)) {
				throw new Error('Invalid response structure: missing dailyMealRecommendations');
			}

			// Ensure we have 7 days
			if (parsed.dailyMealRecommendations.length !== 7) {
				console.warn(`⚠️ Expected 7 days, got ${parsed.dailyMealRecommendations.length}`);
			}

			return parsed;
		} catch (error) {
			console.error('❌ Error parsing AI response:', error);
			console.error('Raw response:', text.substring(0, 500));
			throw new Error('Failed to parse AI nutrition response');
		}
	}

	/**
	 * Generate quick nutrition advice (for simpler use cases)
	 */
	async generateQuickAdvice(pregnancyWeek, symptoms = []) {
		try {
			await this.initialize();

			const prompt = `As a pregnancy nutritionist, provide 5 quick nutrition tips for a woman in week ${pregnancyWeek} of pregnancy${symptoms.length > 0 ? ` experiencing: ${symptoms.join(', ')}` : ''}. Be concise and practical. Return as JSON array of strings.`;

			const result = await this.model.generateContent(prompt);
			const response = await result.response;
			const text = response.text();

			// Try to parse as JSON, fallback to splitting by newlines
			try {
				return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
			} catch {
				return text.split('\n').filter(line => line.trim()).slice(0, 5);
			}
		} catch (error) {
			console.error('Error generating quick advice:', error);
			return ['Eat balanced meals', 'Stay hydrated', 'Take prenatal vitamins'];
		}
	}
}

module.exports = NutritionSuggestionService;
