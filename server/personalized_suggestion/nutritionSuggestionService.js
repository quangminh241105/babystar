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
		this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
		let totalCalcium = 0;
		let totalIron = 0;
		let totalFolicAcid = 0;
		let totalOmega3 = 0;
		let totalFiber = 0;
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
							if (food.calcium) totalCalcium += food.calcium;
							if (food.iron) totalIron += food.iron;
							if (food.folicAcid) totalFolicAcid += food.folicAcid;
							if (food.omega3) totalOmega3 += food.omega3;
							if (food.fiber) totalFiber += food.fiber;
							
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
		const avgCalcium = nutritionDays > 0 ? Math.round(totalCalcium / nutritionDays) : 0;
		const avgIron = nutritionDays > 0 ? Math.round(totalIron / nutritionDays) : 0;
		const avgFolicAcid = nutritionDays > 0 ? Math.round(totalFolicAcid / nutritionDays) : 0;
		const avgOmega3 = nutritionDays > 0 ? parseFloat((totalOmega3 / nutritionDays).toFixed(2)) : 0;
		const avgFiber = nutritionDays > 0 ? Math.round(totalFiber / nutritionDays) : 0;
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
				fat: avgFat,
				calcium: avgCalcium,
				iron: avgIron,
				folicAcid: avgFolicAcid,
				omega3: avgOmega3,
				fiber: avgFiber
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
	 * Get trimester-specific daily nutrition targets
	 */
	getDailyTargetsByTrimester(trimester, pregnancyWeek) {
		// Base targets for first trimester
		const targets = {
			1: {
				calories: 1800, // No extra calories needed in first trimester
				proteinGrams: 60,
				calciumMg: 1000,
				ironMg: 27,
				folicAcidMcg: 600, // Critical in first trimester for neural tube development
				omega3Grams: 1.4,
				fiberGrams: 28,
				hydrationLiters: 2.3
			},
			2: {
				calories: 2200, // Add ~340 extra calories in second trimester
				proteinGrams: 71, // Increased protein for fetal growth
				calciumMg: 1000,
				ironMg: 27,
				folicAcidMcg: 600,
				omega3Grams: 1.4,
				fiberGrams: 28,
				hydrationLiters: 2.5
			},
			3: {
				calories: 2400, // Add ~450 extra calories in third trimester
				proteinGrams: 75, // Peak protein needs for rapid growth
				calciumMg: 1200, // Increased calcium for fetal bone development
				ironMg: 27,
				folicAcidMcg: 600,
				omega3Grams: 1.4,
				fiberGrams: 30, // Extra fiber to help with constipation
				hydrationLiters: 2.7
			}
		};

		return targets[trimester] || targets[2]; // Default to trimester 2 if invalid
	}

	/**
	 * Analyze user's nutrition intake vs targets
	 */
	analyzeNutritionIntake(healthSummary, dailyTargets) {
		const doingWell = [];
		const needsImprovement = [];
		const recommendations = [];

		const intake = healthSummary.averageNutrition || {};

		// Compare each nutrient with target
		if (dailyTargets.calories && intake.calories) {
			const percentage = (intake.calories / dailyTargets.calories) * 100;
			if (percentage >= 90 && percentage <= 110) {
				doingWell.push(`Calories (${intake.calories} kcal/day - ${percentage.toFixed(0)}% of target)`);
			} else if (percentage < 90) {
				needsImprovement.push(`Calories (${intake.calories} kcal/day - only ${percentage.toFixed(0)}% of target)`);
				recommendations.push('Increase calorie intake with nutrient-dense foods like nuts, avocados, and whole grains');
			}
		}

		if (dailyTargets.proteinGrams && intake.protein) {
			const percentage = (intake.protein / dailyTargets.proteinGrams) * 100;
			if (percentage >= 90) {
				doingWell.push(`Protein (${intake.protein}g/day - ${percentage.toFixed(0)}% of target)`);
			} else {
				needsImprovement.push(`Protein (${intake.protein}g/day - only ${percentage.toFixed(0)}% of target)`);
				recommendations.push('Add more protein sources like lean meats, eggs, legumes, and dairy products');
			}
		}

		if (dailyTargets.calciumMg && intake.calcium) {
			const percentage = (intake.calcium / dailyTargets.calciumMg) * 100;
			if (percentage >= 90) {
				doingWell.push(`Calcium (${intake.calcium}mg/day - ${percentage.toFixed(0)}% of target)`);
			} else {
				needsImprovement.push(`Calcium (${intake.calcium}mg/day - only ${percentage.toFixed(0)}% of target)`);
				recommendations.push('Increase calcium intake with dairy products, fortified plant milk, or leafy greens');
			}
		}

		if (dailyTargets.ironMg && intake.iron) {
			const percentage = (intake.iron / dailyTargets.ironMg) * 100;
			if (percentage >= 90) {
				doingWell.push(`Iron (${intake.iron}mg/day - ${percentage.toFixed(0)}% of target)`);
			} else {
				needsImprovement.push(`Iron (${intake.iron}mg/day - only ${percentage.toFixed(0)}% of target)`);
				recommendations.push('Consume more iron-rich foods like lean red meat, spinach, lentils, and fortified cereals');
			}
		}

		if (dailyTargets.folicAcidMcg && intake.folicAcid) {
			const percentage = (intake.folicAcid / dailyTargets.folicAcidMcg) * 100;
			if (percentage >= 90) {
				doingWell.push(`Folic Acid (${intake.folicAcid}mcg/day - ${percentage.toFixed(0)}% of target)`);
			} else {
				needsImprovement.push(`Folic Acid (${intake.folicAcid}mcg/day - only ${percentage.toFixed(0)}% of target)`);
				recommendations.push('Eat more folate-rich foods like leafy greens, citrus fruits, and fortified grains. Continue prenatal vitamins');
			}
		}

		if (dailyTargets.omega3Grams && intake.omega3) {
			const percentage = (intake.omega3 / dailyTargets.omega3Grams) * 100;
			if (percentage >= 90) {
				doingWell.push(`Omega-3 (${intake.omega3}g/day - ${percentage.toFixed(0)}% of target)`);
			} else {
				needsImprovement.push(`Omega-3 (${intake.omega3}g/day - only ${percentage.toFixed(0)}% of target)`);
				recommendations.push('Include more omega-3 sources like fatty fish (salmon, sardines), walnuts, and chia seeds');
			}
		}

		if (dailyTargets.fiberGrams && intake.fiber) {
			const percentage = (intake.fiber / dailyTargets.fiberGrams) * 100;
			if (percentage >= 90) {
				doingWell.push(`Fiber (${intake.fiber}g/day - ${percentage.toFixed(0)}% of target)`);
			} else {
				needsImprovement.push(`Fiber (${intake.fiber}g/day - only ${percentage.toFixed(0)}% of target)`);
				recommendations.push('Add more fiber through whole grains, fruits, vegetables, and legumes to aid digestion');
			}
		}

		return {
			doingWell,
			needsImprovement,
			recommendations
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
				healthSummary: providedHealthSummary,
				dueDate,
				userProfile
			} = userData;

			// Use provided health summary or extract from health logs
			const healthSummary = providedHealthSummary || this.extractHealthLogSummary(healthLogs);

			// Build RAG context
			const ragContext = this.buildRAGContext(pregnancyWeek, trimester, healthSummary);

			// Build comprehensive prompt with current intake analysis
			const prompt = this.buildNutritionPrompt(
				pregnancyWeek,
				trimester,
				healthSummary,
				ragContext,
				userProfile
			);

			console.log('🤖 Generating AI nutrition suggestions with personalization...');
			console.log(`   Week: ${pregnancyWeek}, Symptoms: ${healthSummary.commonSymptoms?.map(s => s.symptom).join(', ') || 'none'}`);
			console.log(`   Current intake - Calcium: ${healthSummary.averageNutrition?.calcium || 0}mg, Iron: ${healthSummary.averageNutrition?.iron || 0}mg`);

			// Retry logic for AI generation
			let nutritionPlan = null;
			let lastError = null;
			const maxRetries = 2;

			for (let attempt = 1; attempt <= maxRetries; attempt++) {
				try {
					console.log(`🔄 Attempt ${attempt}/${maxRetries}...`);
					
					// Generate content using Gemini with higher temperature for more variety
					const result = await this.model.generateContent({
						contents: [{ role: 'user', parts: [{ text: prompt }] }],
						generationConfig: {
							temperature: attempt === 1 ? 1.2 : 0.9, // Lower temperature on retry for more focused response
							topP: 0.95,
							topK: 40,
							maxOutputTokens: 16384,
							candidateCount: 1,
						}
					});
					const response = await result.response;
					const text = response.text();

					// Parse AI response
					nutritionPlan = this.parseAIResponse(text);
					
					console.log('✅ AI nutrition suggestions generated successfully');
					break; // Success, exit retry loop
					
				} catch (parseError) {
					lastError = parseError;
					console.error(`❌ Attempt ${attempt} failed:`, parseError.message);
					
					if (attempt === maxRetries) {
						throw parseError; // All retries exhausted
					}
					
					// Wait a bit before retrying
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			}

			if (!nutritionPlan) {
				throw lastError || new Error('Failed to generate nutrition plan');
			}

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

		const timestamp = new Date().toISOString();
		const uniqueId = `${pregnancyWeek}_${trimester}_${healthSummary.daysWithNutritionData}_${timestamp}`;
		
		// Get trimester-specific nutrition targets
		const dailyTargets = this.getDailyTargetsByTrimester(trimester, pregnancyWeek);
		
		return `You are an expert pregnancy nutritionist AI. Generate a UNIQUE, PERSONALIZED weekly nutrition plan for THIS SPECIFIC pregnant woman.

⚠️ CRITICAL: This plan must be DIFFERENT from other users. Base it SPECIFICALLY on THIS user's data below. DO NOT generate generic plans.

**UNIQUE USER PROFILE (ID: ${uniqueId}):**
- Pregnancy Week: ${pregnancyWeek} (${pregnancyWeek < 13 ? 'FIRST trimester - focus on nausea management, folate' : pregnancyWeek < 28 ? 'SECOND trimester - rapid growth phase, increased iron needs' : 'THIRD trimester - preparation for birth, extra calcium'})
- Trimester: ${trimester}
- Days of Nutrition Data Available: ${healthSummary.daysWithNutritionData}

**TRIMESTER ${trimester} NUTRITION TARGETS:**
${trimester === 1 ? `- Calories: ${dailyTargets.calories} kcal/day (NO extra calories needed yet)
- Protein: ${dailyTargets.proteinGrams}g/day (base requirement)
- Calcium: ${dailyTargets.calciumMg}mg/day (for bone health)
- Folic Acid: ${dailyTargets.folicAcidMcg}mcg/day ⚠️ CRITICAL for neural tube development
- Iron: ${dailyTargets.ironMg}mg/day (prevent anemia)
- Fiber: ${dailyTargets.fiberGrams}g/day (combat nausea-related constipation)
- Hydration: ${dailyTargets.hydrationLiters}L/day` : 
trimester === 2 ? `- Calories: ${dailyTargets.calories} kcal/day (+340 kcal for fetal growth)
- Protein: ${dailyTargets.proteinGrams}g/day (increased for tissue development)
- Calcium: ${dailyTargets.calciumMg}mg/day (fetal bone formation begins)
- Iron: ${dailyTargets.ironMg}mg/day (blood volume expansion)
- Folic Acid: ${dailyTargets.folicAcidMcg}mcg/day (continued brain development)
- Fiber: ${dailyTargets.fiberGrams}g/day
- Hydration: ${dailyTargets.hydrationLiters}L/day` :
`- Calories: ${dailyTargets.calories} kcal/day (+450 kcal for final growth spurt)
- Protein: ${dailyTargets.proteinGrams}g/day ⚠️ PEAK protein needs for baby's growth
- Calcium: ${dailyTargets.calciumMg}mg/day ⚠️ INCREASED for baby's bone hardening
- Iron: ${dailyTargets.ironMg}mg/day (prevent maternal anemia before delivery)
- Fiber: ${dailyTargets.fiberGrams}g/day ⚠️ EXTRA fiber (baby pressing on intestines)
- Hydration: ${dailyTargets.hydrationLiters}L/day (preparation for breastfeeding)`}

**THIS USER'S ACTUAL EATING PATTERNS (Last 7 days):**
${healthSummary.daysWithNutritionData > 0 ? `
  ✓ Current Daily Average:
    • Calories: ${healthSummary.averageNutrition?.calories || 0} kcal ${healthSummary.averageNutrition?.calories < dailyTargets.calories * 0.8 ? '⚠️ BELOW target' : healthSummary.averageNutrition?.calories > dailyTargets.calories * 1.15 ? '⚠️ ABOVE target' : '✓ Good range'}
    • Protein: ${healthSummary.averageNutrition?.protein || 0}g ${healthSummary.averageNutrition?.protein < dailyTargets.proteinGrams * 0.8 ? '⚠️ TOO LOW - CRITICAL DEFICIT' : '✓'}
    • Calcium: ${healthSummary.averageNutrition?.calcium || 0}mg ${healthSummary.averageNutrition?.calcium < dailyTargets.calciumMg * 0.8 ? '⚠️ TOO LOW - CRITICAL DEFICIT' : '✓'}
    • Iron: ${healthSummary.averageNutrition?.iron || 0}mg ${healthSummary.averageNutrition?.iron < dailyTargets.ironMg * 0.7 ? '⚠️ TOO LOW - CRITICAL DEFICIT' : '✓'}
    • Folic Acid: ${healthSummary.averageNutrition?.folicAcid || 0}mcg ${healthSummary.averageNutrition?.folicAcid < dailyTargets.folicAcidMcg * 0.8 ? '⚠️ TOO LOW - CRITICAL DEFICIT' : '✓'}
    • Omega-3: ${healthSummary.averageNutrition?.omega3 || 0}g ${healthSummary.averageNutrition?.omega3 < dailyTargets.omega3Grams * 0.5 ? '⚠️ TOO LOW' : '✓'}
    • Fiber: ${healthSummary.averageNutrition?.fiber || 0}g ${healthSummary.averageNutrition?.fiber < dailyTargets.fiberGrams * 0.8 ? '⚠️ TOO LOW - may cause constipation' : '✓'}
    • Hydration: ${healthSummary.averageHydration || 0}L/day ${healthSummary.averageHydration < dailyTargets.hydrationLiters * 0.8 ? '⚠️ DEHYDRATED' : '✓'}
  
  ✓ Energy Level: ${healthSummary.averageEnergy || 'Not tracked'}/5 ${healthSummary.averageEnergy < 3 ? '⚠️ LOW - needs energy-boosting foods' : '✓ Good'}
  
  ✓ Food Categories User Actually Eats: ${healthSummary.foodCategories ? Object.keys(healthSummary.foodCategories).slice(0, 5).join(', ') : 'Unknown'}
` : `
  ⚠️ NO NUTRITION DATA YET - User is just starting to track
  → Create a BEGINNER-FRIENDLY plan with simple, accessible meals
  → Focus on establishing healthy eating habits
  → Include easy-to-prepare options
`}

**THIS USER'S ACTIVE SYMPTOMS:**
${healthSummary.commonSymptoms && healthSummary.commonSymptoms.length > 0 ? 
  healthSummary.commonSymptoms.map(s => {
    let advice = '';
    if (s.symptom.includes('nausea')) advice = '→ MUST include ginger, small frequent meals, avoid fatty foods';
    else if (s.symptom.includes('constipation')) advice = '→ MUST include HIGH fiber (prunes, whole grains, vegetables)';
    else if (s.symptom.includes('fatigue')) advice = '→ MUST include iron-rich foods, complex carbs';
    else if (s.symptom.includes('heartburn')) advice = '→ MUST avoid spicy/acidic foods, small portions';
    else if (s.symptom.includes('leg_cramps')) advice = '→ MUST include magnesium (bananas, nuts), potassium';
    return `  • ${s.symptom} (reported ${s.count} times) ${advice}`;
  }).join('\n')
  : '  • No symptoms reported - Standard pregnancy nutrition'}

**🎯 MANDATORY PERSONALIZATION REQUIREMENTS FOR THIS USER:**
${identifiedNeeds.length > 0 ? identifiedNeeds.map(need => `  ⚠️ ${need}`).join('\n') : '  ✓ Ensure balanced nutrition for week ' + pregnancyWeek}

**INSTRUCTIONS - READ CAREFULLY:**
1. **MUST BE UNIQUE**: Create DIFFERENT meals for each day. Do NOT repeat the same breakfast 7 times.
2. **ADDRESS THIS USER'S DEFICITS**: If their calcium is ${healthSummary.averageNutrition?.calcium || 0}mg (low), EVERY day must include high-calcium foods.
3. **MATCH THEIR SYMPTOMS**: ${healthSummary.commonSymptoms?.[0]?.symptom ? `Since they have ${healthSummary.commonSymptoms[0].symptom}, adjust meals accordingly` : 'Include variety'}
4. **VARY THE MEALS**: Use different proteins each day (chicken, fish, eggs, legumes, tofu), different vegetables, different grains
5. **REAL PERSONALIZATION**: Two users at week ${pregnancyWeek} should get DIFFERENT plans if they have different symptoms/deficits

**AVAILABLE NUTRIENT-RICH FOODS FROM DATABASE:**

**High-Iron Foods:**
${relevantFoods.iron.map(f => `- ${f.food}: ${f.iron}mg iron, ${f.calories} cal, ${f.protein}g protein`).slice(0, 6).join('\n')}

**High-Calcium Foods:**
${relevantFoods.calcium.map(f => `- ${f.food}: ${f.calcium}mg calcium, ${f.calories} cal`).slice(0, 6).join('\n')}

**High-Protein Foods:**
${relevantFoods.protein.map(f => `- ${f.food}: ${f.protein}g protein, ${f.calories} cal`).slice(0, 6).join('\n')}

**Folic Acid Rich Foods:**
${relevantFoods.folicAcid.map(f => `- ${f.food}: ${f.folicAcid}mcg folic acid, ${f.calories} cal`).slice(0, 6).join('\n')}

**INSTRUCTIONS:**
Generate a complete weekly nutrition plan in the following JSON format. 
⚠️ KEEP MEAL DESCRIPTIONS BRIEF (max 15 words per meal).
⚠️ Use SHORT portion descriptions (e.g., "150g chicken, 200g rice").
⚠️ Limit alternatives to 2 per meal maximum.

Return ONLY valid JSON with NO markdown, NO code blocks, NO extra text:

{
  "dailyMealRecommendations": [
    {
      "day": "Monday",
      "breakfast": {
        "meal": "Oatmeal with berries and almonds",
        "portion": "50g oats, 100g berries, 20g almonds, 200ml milk",
        "alternatives": ["Scrambled eggs with toast", "Greek yogurt with fruit"],
        "estimatedCalories": 350,
        "proteinGrams": 15,
        "calciumMg": 200,
        "ironMg": 2.5,
        "folicAcidMcg": 80,
        "omega3Grams": 0.3,
        "fiberGrams": 4
      },
      "lunch": {
        "meal": "Grilled chicken salad",
        "portion": "120g chicken, 150g mixed greens, dressing",
        "alternatives": ["Tuna sandwich", "Lentil soup"],
        "estimatedCalories": 500,
        "proteinGrams": 25,
        "calciumMg": 150,
        "ironMg": 4,
        "folicAcidMcg": 100,
        "omega3Grams": 0.5,
        "fiberGrams": 6
      },
      "dinner": {
        "meal": "Salmon with quinoa and vegetables",
        "portion": "150g salmon, 100g quinoa, 150g vegetables",
        "alternatives": ["Beef stir-fry", "Tofu curry"],
        "estimatedCalories": 550,
        "proteinGrams": 30,
        "calciumMg": 100,
        "ironMg": 3.5,
        "folicAcidMcg": 120,
        "omega3Grams": 0.4,
        "fiberGrams": 5
      },
      "snacks": [
        {
          "name": "Almonds and apple",
          "time": "Mid-morning",
          "portion": "30g almonds, 1 medium apple",
          "estimatedCalories": 150,
          "proteinGrams": 5,
          "calciumMg": 150,
          "ironMg": 1,
          "folicAcidMcg": 20,
          "omega3Grams": 0.2,
          "fiberGrams": 2
        },
        {
          "name": "Greek yogurt",
          "time": "Afternoon",
          "portion": "150g Greek yogurt",
          "estimatedCalories": 120,
          "proteinGrams": 15,
          "calciumMg": 200,
          "ironMg": 0.5,
          "folicAcidMcg": 10,
          "omega3Grams": 0.1,
          "fiberGrams": 0
        }
      ]
    }
  ],
  "nutrientFocus": ["Iron", "Calcium", "Folic Acid", "Protein", "Omega-3"],
  "foodsToAvoid": ["Raw fish", "Unpasteurized cheese", "Deli meats", "High mercury fish"],
  "dailyTargets": {
    "calories": ${dailyTargets.calories},
    "proteinGrams": ${dailyTargets.proteinGrams},
    "calciumMg": ${dailyTargets.calciumMg},
    "ironMg": ${dailyTargets.ironMg},
    "folicAcidMcg": ${dailyTargets.folicAcidMcg},
    "omega3Grams": ${dailyTargets.omega3Grams},
    "fiberGrams": ${dailyTargets.fiberGrams}
  },
  "recommendedFoods": [
    {
      "nutrient": "Iron",
      "foods": ["Food from database 1", "Food from database 2"]
    }
  ],
  "mealPrepTips": ["Brief tip 1", "Brief tip 2", "Brief tip 3"],
  "hydrationGoals": {
    "dailyWaterLiters": ${dailyTargets.hydrationLiters},
    "tips": ["Carry water bottle", "Drink before meals"]
  },
  "supplementsNeeded": ["Prenatal vitamin", "Vitamin D"],
  "specialConsiderations": ["Brief consideration based on symptoms"]
}

**CRITICAL RULES:**
1. Generate 7 DIFFERENT days (Monday-Sunday)
2. Keep meal names SHORT (max 8 words)
3. Keep portion text BRIEF (max 12 words)
4. Only 2 alternatives per meal
5. Use realistic nutrient estimates
6. Focus on THIS user's deficits: ${healthSummary.averageNutrition?.iron < 20 ? 'LOW IRON' : ''} ${healthSummary.averageNutrition?.calcium < 800 ? 'LOW CALCIUM' : ''}
7. Return ONLY JSON, no extra text

Return JSON NOW:`;
	}

	/**
	 * Parse AI response and ensure it matches the expected format
	 */
	parseAIResponse(text) {
		try {
			// Remove markdown code blocks if present
			let cleanText = text.trim();
			if (cleanText.startsWith('```json')) {
				cleanText = cleanText.replace(/^```json\n?/g, '').replace(/\n?```$/g, '');
			} else if (cleanText.startsWith('```')) {
				cleanText = cleanText.replace(/^```\n?/g, '').replace(/\n?```$/g, '');
			}

			// Try to find JSON object boundaries if response is truncated
			const jsonStart = cleanText.indexOf('{');
			const jsonEnd = cleanText.lastIndexOf('}');
			if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
				cleanText = cleanText.substring(jsonStart, jsonEnd + 1);
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

			// Ensure nutrientFocus is an array (fallback to default if missing)
			if (!parsed.nutrientFocus || !Array.isArray(parsed.nutrientFocus)) {
				console.warn('⚠️ nutrientFocus missing or invalid, using default');
				parsed.nutrientFocus = ["Iron", "Calcium", "Folic Acid", "Protein", "Omega-3"];
			}

			// Ensure dailyTargets exists
			if (!parsed.dailyTargets) {
				console.warn('⚠️ dailyTargets missing in AI response');
				parsed.dailyTargets = {};
			}

			return parsed;
		} catch (error) {
			console.error('❌ Error parsing AI response:', error);
			console.error('Raw response (first 1000 chars):', text.substring(0, 1000));
			console.error('Raw response (last 500 chars):', text.substring(text.length - 500));
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
