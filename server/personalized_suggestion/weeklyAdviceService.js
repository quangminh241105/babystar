const { GoogleGenerativeAI } = require('@google/generative-ai');
const MaternalHealthDataLoader = require('./maternalHealthDataLoader');

/**
 * AI-powered Weekly Pregnancy Advice Service
 * Generates personalized weekly advice based on user's pregnancy progress and health logs
 */
class WeeklyAdviceService {
	constructor() {
		this.apiKey = process.env.GEMINI_API_KEY_WEEKLY_ADVICE;
		if (!this.apiKey) {
			throw new Error('GEMINI_API_KEY_WEEKLY_ADVICE not found in environment variables');
		}

		this.genAI = new GoogleGenerativeAI(this.apiKey);
		this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
		this.healthDataLoader = new MaternalHealthDataLoader();
		this.dataLoaded = false;
	}

	/**
	 * Extract health summary from recent logs
	 */
	extractHealthSummary(healthLogs, userAge) {
		if (!healthLogs || healthLogs.length === 0) {
			return {
				commonSymptoms: [],
				averageEnergy: null,
				averageHydration: null,
				exerciseDays: 0,
				totalExerciseMinutes: 0,
				latestVitals: null
			};
		}

		// Get common symptoms
		const symptomCounts = {};
		healthLogs.forEach(log => {
			if (log.symptoms && log.symptoms.length > 0) {
				log.symptoms.forEach(s => {
					const symptom = s.symptom || s;
					symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
				});
			}
		});

		const commonSymptoms = Object.entries(symptomCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([symptom, count]) => ({ symptom, count }));

		// Calculate averages
		const energyLevels = healthLogs.map(l => l.energyLevel).filter(e => e != null);
		const avgEnergy = energyLevels.length > 0 
			? (energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length).toFixed(1)
			: null;

		const hydrationValues = healthLogs.map(l => l.hydration?.liters).filter(h => h != null);
		const avgHydration = hydrationValues.length > 0
			? (hydrationValues.reduce((a, b) => a + b, 0) / hydrationValues.length).toFixed(1)
			: null;

		// Exercise stats
		let exerciseDays = 0;
		let totalExerciseMinutes = 0;
		healthLogs.forEach(log => {
			if (log.exercises && log.exercises.length > 0) {
				exerciseDays++;
				log.exercises.forEach(ex => {
					totalExerciseMinutes += ex.durationMinutes || 0;
				});
			}
		});

		// Get latest vitals for risk assessment
		let latestVitals = null;
		for (const log of healthLogs) {
			if (log.bloodPressure?.systolic || log.heartRateBpm || log.bloodSugarLevel) {
				latestVitals = {
					age: userAge,
					systolicBP: log.bloodPressure?.systolic,
					diastolicBP: log.bloodPressure?.diastolic,
					heartRate: log.heartRateBpm,
					bloodSugar: log.bloodSugarLevel,
					bodyTemp: log.bodyTemperature
				};
				break; // Use most recent
			}
		}

		return {
			commonSymptoms,
			averageEnergy: avgEnergy,
			averageHydration: avgHydration,
			exerciseDays,
			totalExerciseMinutes,
			latestVitals
		};
	}

	/**
	 * Build AI prompt for weekly advice
	 */
	async buildAdvicePrompt(pregnancyWeek, trimester, healthSummary, userProfile) {
		const timestamp = new Date().toISOString();
		
		// Perform risk assessment if vitals available
		let riskAssessment = null;
		if (healthSummary.latestVitals && this.dataLoaded) {
			riskAssessment = await this.healthDataLoader.assessRisk(healthSummary.latestVitals);
		}

		let riskSection = '';
		if (riskAssessment) {
			const rec = riskAssessment.recommendations || {};
			riskSection = `
**MATERNAL HEALTH RISK ASSESSMENT:**
- Risk Level: ${riskAssessment.riskLevel ? riskAssessment.riskLevel.toUpperCase() : 'UNKNOWN'}
- Confidence: ${typeof riskAssessment.confidence === 'number' ? (riskAssessment.confidence * 100).toFixed(0) : 50}%
- Risk Factors: ${riskAssessment.riskFactors && riskAssessment.riskFactors.length > 0 ? riskAssessment.riskFactors.join(', ') : 'None detected'}
- Latest Vitals: BP ${healthSummary.latestVitals.systolicBP || 'N/A'}/${healthSummary.latestVitals.diastolicBP || 'N/A'}, HR ${healthSummary.latestVitals.heartRate || 'N/A'} bpm, BS ${healthSummary.latestVitals.bloodSugar || 'N/A'} mmol/L
${rec.specificActions && rec.specificActions.length > 0 ? `- Dataset Recommendations: ${rec.specificActions.join('; ')}` : ''}
${rec.monitoring ? `- Monitoring: ${rec.monitoring}` : ''}
${rec.alerts && Array.isArray(rec.alerts) && rec.alerts.length > 0 ? `- Alert If: ${rec.alerts.join(', ')}` : ''}
`;
		}
		
		return `You are an expert prenatal care advisor. Generate personalized weekly pregnancy advice for THIS SPECIFIC pregnant woman.

**USER PROFILE:**
- Pregnancy Week: ${pregnancyWeek} (Trimester ${trimester})
- Days of Health Data Available: ${healthSummary.commonSymptoms.length > 0 ? 'Yes' : 'No'}
${riskSection}
**USER'S RECENT SYMPTOMS (Last 7 days):**
${healthSummary.commonSymptoms.length > 0 ? 
	healthSummary.commonSymptoms.map(s => `  • ${s.symptom} (reported ${s.count} times)`).join('\n')
	: '  • No symptoms reported recently'}

**USER'S ACTIVITY LEVELS:**
- Average Energy Level: ${healthSummary.averageEnergy || 'Not tracked'}/5
- Hydration: ${healthSummary.averageHydration || 'Not tracked'}L/day
- Exercise: ${healthSummary.totalExerciseMinutes} minutes over ${healthSummary.exerciseDays} days this week

**TRIMESTER ${trimester} CONTEXT:**
${trimester === 1 ? 
	`First Trimester (Weeks 1-12):
- Common: Morning sickness, fatigue, breast tenderness
- Focus: Folic acid, managing nausea, rest
- Baby: Organs forming, neural tube development` :
trimester === 2 ?
	`Second Trimester (Weeks 13-27):
- Common: Energy boost, baby movements, back pain
- Focus: Calcium, iron, staying active
- Baby: Rapid growth, gender may be visible, hearing develops` :
	`Third Trimester (Weeks 28-40):
- Common: Frequent urination, heartburn, Braxton Hicks
- Focus: Prepare for labor, pelvic floor, rest
- Baby: Weight gain, lung development, preparing for birth`}

**TASK:**
Generate personalized advice in the following JSON format. Address THIS user's specific symptoms and activity levels${riskAssessment ? '. IMPORTANT: Address the identified risk factors and incorporate dataset recommendations.' : ''}.

Return ONLY valid JSON (no markdown):

{
  "symptomAdvice": [
    {
      "symptom": "Specific symptom name from user's logs OR common trimester symptom",
      "advice": "Brief actionable advice (max 25 words)",
      "severity": "mild|moderate|severe"
    }
  ],
  "weeklyGuidance": {
    "fetalDevelopment": "What's happening with baby this week (2-3 sentences)",
    "selfCare": "Key self-care focus for this week (2-3 sentences)",
    "nutritionTip": "Specific nutrition advice for week ${pregnancyWeek} (1-2 sentences)",
    "activityTip": "Exercise/movement guidance (1-2 sentences)"${riskAssessment && riskAssessment.riskLevel ? ',\n    "riskManagement": "Specific advice for managing the ' + riskAssessment.riskLevel + ' risk level (2-3 sentences)"' : ''}
  },
  "focusAreas": [
    {
      "title": "Nutrition",
      "icon": "🥗",
      "description": "Specific nutrition focus based on trimester and symptoms (max 20 words)",
      "action": "Actionable next step (max 5 words)"
    },
    {
      "title": "Movement",
      "icon": "🚶‍♀️",
      "description": "Activity/exercise recommendation based on energy level (max 20 words)",
      "action": "Actionable next step (max 5 words)"
    },
    {
      "title": "Rest & Sleep",
      "icon": "🛏️",
      "description": "Sleep advice based on trimester (max 20 words)",
      "action": "Actionable next step (max 5 words)"
    },
    {
      "title": "Mental Wellbeing",
      "icon": "🧘‍♀️",
      "description": "Stress management based on current state (max 20 words)",
      "action": "Actionable next step (max 5 words)"
    }${riskAssessment && riskAssessment.riskFactors && riskAssessment.riskFactors.length > 0 ? ',\n    {\n      "title": "Health Monitoring",\n      "icon": "🏥",\n      "description": "Monitor ' + riskAssessment.riskFactors.join(', ') + ' (max 20 words)",\n      "action": "' + ((riskAssessment.recommendations && riskAssessment.recommendations.monitoring) || 'Track vitals daily') + '"\n    }' : ''}
  ],${riskAssessment ? '\n  "riskAssessment": {\n    "level": "' + (riskAssessment.riskLevel || 'unknown') + '",\n    "confidence": ' + (riskAssessment.confidence || 0.5) + ',\n    "factors": ' + JSON.stringify(riskAssessment.riskFactors || []) + ',\n    "vitals": {\n      "bloodPressure": "' + (healthSummary.latestVitals.systolicBP || 'N/A') + '/' + (healthSummary.latestVitals.diastolicBP || 'N/A') + '",\n      "heartRate": ' + (healthSummary.latestVitals.heartRate || 'null') + ',\n      "bloodSugar": ' + (healthSummary.latestVitals.bloodSugar || 'null') + '\n    },\n    "recommendations": ' + JSON.stringify((riskAssessment.recommendations && riskAssessment.recommendations.specificActions) || []) + '\n  },' : ''}
  "weekNumber": ${pregnancyWeek},
  "trimester": ${trimester}
}

**CRITICAL RULES:**
1. If user has logged symptoms, prioritize advice for those symptoms
2. If no symptoms logged, provide 2-3 common trimester-appropriate symptoms with preventive advice
3. Keep all text concise and actionable
4. Base advice on actual pregnancy week ${pregnancyWeek}
5. Consider user's energy level (${healthSummary.averageEnergy || 'unknown'}) when recommending activity${riskAssessment && riskAssessment.recommendations && riskAssessment.recommendations.monitoring ? '\n6. Incorporate risk factor monitoring in all advice areas\n7. Emphasize ' + riskAssessment.recommendations.monitoring.toLowerCase() + ' as per dataset analysis' : ''}
6. Return ONLY JSON, no extra text

Generate NOW:`;
	}

	/**
	 * Parse AI response
	 */
	parseAIResponse(text) {
		try {
			let cleanText = text.trim();
			
			// Remove markdown code blocks
			if (cleanText.startsWith('```json')) {
				cleanText = cleanText.replace(/^```json\n?/g, '').replace(/\n?```$/g, '');
			} else if (cleanText.startsWith('```')) {
				cleanText = cleanText.replace(/^```\n?/g, '').replace(/\n?```$/g, '');
			}

			// Try to find JSON boundaries
			const jsonStart = cleanText.indexOf('{');
			const jsonEnd = cleanText.lastIndexOf('}');
			if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
				cleanText = cleanText.substring(jsonStart, jsonEnd + 1);
			}

			const parsed = JSON.parse(cleanText);

			// Validate structure
			if (!parsed.symptomAdvice || !Array.isArray(parsed.symptomAdvice)) {
				console.warn('⚠️ Missing symptomAdvice, using defaults');
				parsed.symptomAdvice = [];
			}

			if (!parsed.weeklyGuidance) {
				console.warn('⚠️ Missing weeklyGuidance, using defaults');
				parsed.weeklyGuidance = {};
			}

			if (!parsed.focusAreas || !Array.isArray(parsed.focusAreas)) {
				console.warn('⚠️ Missing focusAreas, using defaults');
				parsed.focusAreas = [];
			}

			return parsed;
		} catch (error) {
			console.error('❌ Error parsing AI advice response:', error);
			console.error('Raw response (first 1000 chars):', text.substring(0, 1000));
			throw new Error('Failed to parse AI weekly advice response');
		}
	}

	/**
	 * Generate weekly advice
	 */
	async generateWeeklyAdvice({ pregnancyWeek, trimester, healthLogs, userProfile }) {
		try {
			await this.initialize();

			// Extract health summary (pass user age for risk assessment)
			const healthSummary = this.extractHealthSummary(healthLogs, userProfile.age);

			// Build prompt with risk assessment
			const prompt = await this.buildAdvicePrompt(pregnancyWeek, trimester, healthSummary, userProfile);

			console.log('🤖 Generating AI weekly advice...');
			console.log(`   Week: ${pregnancyWeek}, Symptoms: ${healthSummary.commonSymptoms.map(s => s.symptom).join(', ') || 'none'}`);

			// Generate with retry logic
			let advice = null;
			let lastError = null;
			const maxRetries = 2;

			for (let attempt = 1; attempt <= maxRetries; attempt++) {
				try {
					console.log(`🔄 Attempt ${attempt}/${maxRetries}...`);
					
					const result = await this.model.generateContent({
						contents: [{ role: 'user', parts: [{ text: prompt }] }],
						generationConfig: {
							temperature: attempt === 1 ? 1.0 : 0.8,
							topP: 0.95,
							topK: 40,
							maxOutputTokens: 4096,
							candidateCount: 1,
						}
					});
					
					const response = await result.response;
					const text = response.text();

					advice = this.parseAIResponse(text);
					
					console.log('✅ AI weekly advice generated successfully');
					break;
					
				} catch (parseError) {
					lastError = parseError;
					console.error(`❌ Attempt ${attempt} failed:`, parseError.message);
					
					if (attempt === maxRetries) {
						throw parseError;
					}
					
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			}

			if (!advice) {
				throw lastError || new Error('Failed to generate weekly advice');
			}

			return advice;
		} catch (error) {
			console.error('❌ Error generating weekly advice:', error);
			throw error;
		}
	}

	/**
	 * Initialize data loader
	 */
	async initialize() {
		if (!this.dataLoaded) {
			await this.healthDataLoader.loadData();
			this.dataLoaded = true;
			console.log('✅ Maternal health dataset loaded');
		}
		return Promise.resolve();
	}
}

module.exports = WeeklyAdviceService;
