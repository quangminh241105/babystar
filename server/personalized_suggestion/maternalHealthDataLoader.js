const fs = require('fs').promises;
const path = require('path');

/**
 * Maternal Health Risk Data Loader
 * Loads and analyzes maternal health risk dataset
 */
class MaternalHealthDataLoader {
	constructor() {
		this.datasetPath = path.join(__dirname, '../../dataset/maternal_health.csv');
		this.data = [];
		this.riskProfiles = {
			'low risk': [],
			'mid risk': [],
			'high risk': []
		};
	}

	/**
	 * Load and parse maternal health dataset
	 */
	async loadData() {
		if (this.data.length > 0) {
			console.log('✅ Maternal health data already loaded (cached)');
			return;
		}

		try {
			console.log('📊 Loading maternal health risk dataset...');
			const csvContent = await fs.readFile(this.datasetPath, 'utf-8');
			const lines = csvContent.trim().split('\n');
			
			// Parse header
			const headers = lines[0].split(',').map(h => h.trim());
			
			// Parse data rows
			for (let i = 1; i < lines.length; i++) {
				const values = lines[i].split(',');
				if (values.length !== headers.length) continue;
				
				const record = {
					age: parseFloat(values[0]),
					systolicBP: parseFloat(values[1]),
					diastolicBP: parseFloat(values[2]),
					bloodSugar: parseFloat(values[3]),
					bodyTemp: parseFloat(values[4]),
					heartRate: parseFloat(values[5]),
					riskLevel: values[6].trim().toLowerCase(),
					bodyTempC: parseFloat(values[7])
				};
				
				this.data.push(record);
				
				// Group by risk level
				if (this.riskProfiles[record.riskLevel]) {
					this.riskProfiles[record.riskLevel].push(record);
				}
			}
			
			console.log(`✅ Loaded ${this.data.length} maternal health records`);
			console.log(`   Low Risk: ${this.riskProfiles['low risk'].length}`);
			console.log(`   Mid Risk: ${this.riskProfiles['mid risk'].length}`);
			console.log(`   High Risk: ${this.riskProfiles['high risk'].length}`);
			
		} catch (error) {
			console.error('❌ Error loading maternal health data:', error);
			throw error;
		}
	}

	/**
	 * Calculate risk profile statistics for each risk level
	 */
	getRiskProfileStats() {
		const stats = {};
		
		for (const [riskLevel, records] of Object.entries(this.riskProfiles)) {
			if (records.length === 0) continue;
			
			const calc = (field) => {
				const values = records.map(r => r[field]).filter(v => !isNaN(v));
				if (values.length === 0) return { min: 0, max: 0, avg: 0 };
				return {
					min: Math.min(...values),
					max: Math.max(...values),
					avg: values.reduce((a, b) => a + b, 0) / values.length
				};
			};
			
			stats[riskLevel] = {
				count: records.length,
				age: calc('age'),
				systolicBP: calc('systolicBP'),
				diastolicBP: calc('diastolicBP'),
				bloodSugar: calc('bloodSugar'),
				heartRate: calc('heartRate'),
				bodyTemp: calc('bodyTemp')
			};
		}
		
		return stats;
	}

	/**
	 * Assess user's risk level based on their health metrics
	 */
	assessRisk(userMetrics) {
		const {
			age,
			systolicBP,
			diastolicBP,
			bloodSugar,
			heartRate,
			bodyTemp
		} = userMetrics;

		// Find similar cases in dataset
		const similarCases = this.data.filter(record => {
			const ageMatch = age ? Math.abs(record.age - age) <= 5 : true;
			const bpMatch = systolicBP && diastolicBP ? 
				Math.abs(record.systolicBP - systolicBP) <= 10 &&
				Math.abs(record.diastolicBP - diastolicBP) <= 10 : true;
			const hrMatch = heartRate ? Math.abs(record.heartRate - heartRate) <= 10 : true;
			
			return ageMatch && bpMatch && hrMatch;
		});

		// Calculate risk distribution from similar cases
		const riskCounts = {
			'low': 0,
			'mid': 0,
			'high': 0
		};

		similarCases.forEach(c => {
			// Normalize risk level from dataset ("low risk" -> "low")
			const normalizedRisk = c.riskLevel.replace(' risk', '').trim();
			if (riskCounts[normalizedRisk] !== undefined) {
				riskCounts[normalizedRisk]++;
			}
		});

		// Determine most common risk level
		let predictedRisk = 'mid';
		let maxCount = 0;
		for (const [risk, count] of Object.entries(riskCounts)) {
			if (count > maxCount) {
				maxCount = count;
				predictedRisk = risk;
			}
		}

		// Additional rule-based checks
		const riskFactors = [];
		
		if (systolicBP && systolicBP >= 140) riskFactors.push('High systolic blood pressure');
		if (diastolicBP && diastolicBP >= 90) riskFactors.push('High diastolic blood pressure');
		if (systolicBP && systolicBP < 90) riskFactors.push('Low systolic blood pressure');
		if (bloodSugar && bloodSugar > 12) riskFactors.push('Elevated blood sugar');
		if (heartRate && heartRate > 100) riskFactors.push('Elevated heart rate');
		if (heartRate && heartRate < 60) riskFactors.push('Low heart rate');
		if (bodyTemp && bodyTemp > 100) riskFactors.push('Elevated body temperature (possible fever)');
		if (age && age > 35) riskFactors.push('Advanced maternal age (35+)');
		if (age && age < 20) riskFactors.push('Young maternal age (under 20)');

		// Escalate risk if multiple factors present
		if (riskFactors.length >= 3 && predictedRisk === 'low') {
			predictedRisk = 'mid';
		}
		if (riskFactors.length >= 4 && predictedRisk !== 'high') {
			predictedRisk = 'high';
		}

		// Calculate numeric confidence (0-1)
		const confidence = similarCases.length > 10 ? 0.85 :
		                   similarCases.length > 5 ? 0.7 :
		                   similarCases.length > 0 ? 0.5 : 0.4;

		// Get recommendations
		const recommendations = this.getRiskRecommendations(predictedRisk, riskFactors);

		return {
			riskLevel: predictedRisk,
			riskFactors,
			similarCasesCount: similarCases.length,
			riskDistribution: riskCounts,
			confidence,
			recommendations
		};
	}

	/**
	 * Get risk-specific recommendations
	 */
	getRiskRecommendations(riskLevel, riskFactors) {
		const baseRecommendations = {
			'low': {
				monitoring: 'Regular prenatal checkups as scheduled',
				lifestyle: 'Continue healthy diet and moderate exercise',
				alerts: ['Monitor for any unusual symptoms']
			},
			'mid': {
				monitoring: 'More frequent prenatal monitoring recommended',
				lifestyle: 'Focus on stress reduction and balanced nutrition',
				alerts: ['Contact healthcare provider if symptoms worsen']
			},
			'high': {
				monitoring: 'Close medical supervision required - weekly checkups recommended',
				lifestyle: 'Reduce physical strain, prioritize rest, strict diet control',
				alerts: ['Severe headache', 'Vision changes', 'Severe abdominal pain', 'Heavy bleeding']
			}
		};

		const recommendations = baseRecommendations[riskLevel] || baseRecommendations['mid'];
		
		// Add specific recommendations based on risk factors
		const specificActions = [];
		
		riskFactors.forEach(factor => {
			if (factor.includes('blood pressure')) {
				specificActions.push('Monitor blood pressure daily');
				specificActions.push('Reduce sodium intake');
			}
			if (factor.includes('blood sugar')) {
				specificActions.push('Monitor blood glucose levels');
				specificActions.push('Follow diabetic pregnancy diet');
			}
			if (factor.includes('heart rate')) {
				specificActions.push('Avoid strenuous activities');
				specificActions.push('Discuss with cardiologist if persistent');
			}
			if (factor.includes('temperature')) {
				specificActions.push('Monitor for signs of infection');
				specificActions.push('Stay hydrated and rest');
			}
		});

		return {
			...recommendations,
			specificActions: [...new Set(specificActions)] // Remove duplicates
		};
	}
}

module.exports = MaternalHealthDataLoader;
