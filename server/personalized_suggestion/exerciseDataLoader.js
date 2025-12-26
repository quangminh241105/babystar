const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Global singleton cache to avoid reloading CSV files on every request
let globalExerciseCache = null;
let cacheLoadingPromise = null;

/**
 * Load and parse exercise dataset from CSV and JSON files
 * This creates the knowledge base for RAG (Retrieval-Augmented Generation)
 */
class ExerciseDataLoader {
	constructor() {
		this.exerciseData = {
			recommended: [],
			toAvoid: [],
			weeklyGuidance: []
		};
		this.datasetPath = path.join(__dirname, '../../dataset/pregnant-exercise');
	}

	/**
	 * Load all exercise data files (with global caching for performance)
	 */
	async loadExerciseData() {
		// Return cached data if available
		if (globalExerciseCache) {
			this.exerciseData = globalExerciseCache;
			return this.exerciseData;
		}

		// If another request is already loading, wait for it
		if (cacheLoadingPromise) {
			await cacheLoadingPromise;
			this.exerciseData = globalExerciseCache;
			return this.exerciseData;
		}

		// Start loading
		cacheLoadingPromise = this._loadFromFiles();
		try {
			const data = await cacheLoadingPromise;
			globalExerciseCache = data;
			this.exerciseData = data;
			console.log(`✅ Loaded exercise data: ${data.recommended.length} recommended, ${data.toAvoid.length} to avoid (cached)`);
			return this.exerciseData;
		} finally {
			cacheLoadingPromise = null;
		}
	}

	/**
	 * Internal method to load files
	 */
	async _loadFromFiles() {
		try {
			const [recommended, toAvoid, weeklyGuidance] = await Promise.all([
				this.parseCSV(path.join(this.datasetPath, 'nasm_pregnancy_exercises_20251215_150148.csv')),
				this.parseCSV(path.join(this.datasetPath, 'nasm_exercises_to_avoid_20251215_150148.csv')),
				this.parseJSON(path.join(this.datasetPath, 'nhs_cleaned_week_exercise_info.json'))
			]);

			return {
				recommended: recommended || [],
				toAvoid: toAvoid || [],
				weeklyGuidance: weeklyGuidance || []
			};
		} catch (error) {
			console.error('❌ Error loading exercise data:', error);
			throw error;
		}
	}

	/**
	 * Parse a CSV file and return an array of exercise objects
	 */
	parseCSV(filePath) {
		return new Promise((resolve, reject) => {
			const results = [];
			
			if (!fs.existsSync(filePath)) {
				console.warn(`⚠️ File not found: ${filePath}`);
				resolve([]);
				return;
			}

			fs.createReadStream(filePath)
				.pipe(csv())
				.on('data', (data) => {
					results.push(data);
				})
				.on('end', () => {
					resolve(results);
				})
				.on('error', (error) => {
					console.error(`Error reading CSV ${filePath}:`, error);
					reject(error);
				});
		});
	}

	/**
	 * Parse a JSON file
	 */
	parseJSON(filePath) {
		return new Promise((resolve, reject) => {
			if (!fs.existsSync(filePath)) {
				console.warn(`⚠️ File not found: ${filePath}`);
				resolve([]);
				return;
			}

			fs.readFile(filePath, 'utf8', (error, data) => {
				if (error) {
					console.error(`Error reading JSON ${filePath}:`, error);
					reject(error);
				} else {
					try {
						const parsed = JSON.parse(data);
						resolve(parsed);
					} catch (parseError) {
						console.error(`Error parsing JSON ${filePath}:`, parseError);
						reject(parseError);
					}
				}
			});
		});
	}

	/**
	 * Get recommended exercises by trimester
	 */
	getExercisesByTrimester(trimester) {
		if (!this.exerciseData.recommended) return [];
		
		return this.exerciseData.recommended.filter(ex => {
			const trimesterField = ex.Trimester || ex.trimester || '';
			return trimesterField.toLowerCase().includes(`t${trimester}`) || 
			       trimesterField.toLowerCase().includes('all');
		});
	}

	/**
	 * Get exercises by category
	 */
	getExercisesByCategory(category) {
		if (!this.exerciseData.recommended) return [];
		
		return this.exerciseData.recommended.filter(ex => {
			const cat = ex.Category || ex.category || '';
			return cat.toLowerCase().includes(category.toLowerCase());
		});
	}

	/**
	 * Get exercises to avoid
	 */
	getExercisesToAvoid() {
		return this.exerciseData.toAvoid || [];
	}

	/**
	 * Get weekly exercise guidance by pregnancy week
	 */
	getWeeklyGuidance(pregnancyWeek) {
		if (!this.exerciseData.weeklyGuidance || this.exerciseData.weeklyGuidance.length === 0) {
			return null;
		}

		// Find guidance for the specific week or closest match
		const guidance = this.exerciseData.weeklyGuidance.find(g => {
			const week = parseInt(g.week || g.Week || 0);
			return week === pregnancyWeek;
		});

		return guidance || null;
	}

	/**
	 * Search exercises by name or description
	 */
	searchExercises(query, limit = 10) {
		if (!this.exerciseData.recommended) return [];
		
		const searchTerm = query.toLowerCase();
		return this.exerciseData.recommended
			.filter(ex => {
				const name = (ex.Exercise || ex.exercise || '').toLowerCase();
				const desc = (ex.Description || ex.description || '').toLowerCase();
				const category = (ex.Category || ex.category || '').toLowerCase();
				return name.includes(searchTerm) || 
				       desc.includes(searchTerm) || 
				       category.includes(searchTerm);
			})
			.slice(0, limit);
	}

	/**
	 * Get exercise context for AI prompt
	 */
	getExerciseContext(trimester, pregnancyWeek) {
		const trimesterExercises = this.getExercisesByTrimester(trimester);
		const toAvoid = this.getExercisesToAvoid();
		const weeklyGuidance = this.getWeeklyGuidance(pregnancyWeek);

		return {
			trimesterExercises: trimesterExercises.slice(0, 15),
			exercisesToAvoid: toAvoid.slice(0, 10),
			weeklyGuidance
		};
	}
}

module.exports = ExerciseDataLoader;
