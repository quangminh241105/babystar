const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

/**
 * Load and parse nutrition dataset from CSV files
 * This creates the knowledge base for RAG (Retrieval-Augmented Generation)
 * Uses singleton pattern for caching loaded data across requests
 */

// Module-level cache for singleton pattern
let cachedInstance = null;
let isLoading = false;
let loadPromise = null;

class NutritionDataLoader {
	constructor() {
		this.nutritionData = [];
		this.datasetPath = path.join(__dirname, '../../dataset/nutrition-dataset');
		// Precomputed indexes for faster lookups
		this._indexByNutrient = {};
		this._searchIndex = {};
	}

	/**
	 * Get singleton instance with loaded data
	 */
	static async getInstance() {
		if (cachedInstance && cachedInstance.nutritionData.length > 0) {
			return cachedInstance;
		}
		
		if (isLoading && loadPromise) {
			await loadPromise;
			return cachedInstance;
		}
		
		cachedInstance = new NutritionDataLoader();
		isLoading = true;
		loadPromise = cachedInstance.loadNutritionData();
		await loadPromise;
		isLoading = false;
		return cachedInstance;
	}

	/**
	 * Load all nutrition CSV files
	 */
	async loadNutritionData() {
		// Return cached data if already loaded
		if (this.nutritionData.length > 0) {
			return this.nutritionData;
		}
		
		try {
			const files = [
				'FOOD-DATA-GROUP1.csv',
				'FOOD-DATA-GROUP2.csv',
				'FOOD-DATA-GROUP3.csv',
				'FOOD-DATA-GROUP4.csv',
				'FOOD-DATA-GROUP5.csv'
			];

			// Load all files in parallel for faster startup
			const loadPromises = files.map(file => {
				const filePath = path.join(this.datasetPath, file);
				return this.parseCSV(filePath);
			});
			
			const results = await Promise.all(loadPromises);
			this.nutritionData = results.flat();
			
			// Build indexes for faster lookups
			this._buildIndexes();

			console.log(`✅ Loaded ${this.nutritionData.length} food items from nutrition dataset`);
			return this.nutritionData;
		} catch (error) {
			console.error('❌ Error loading nutrition data:', error);
			throw error;
		}
	}
	
	/**
	 * Build indexes for faster nutrient lookups
	 */
	_buildIndexes() {
		const nutrients = ['iron', 'calcium', 'protein', 'folicAcid', 'fiber', 'omega3'];
		
		for (const nutrient of nutrients) {
			this._indexByNutrient[nutrient] = [...this.nutritionData]
				.filter(food => food[nutrient] > 0)
				.sort((a, b) => b[nutrient] - a[nutrient]);
		}
		
		// Build search index (lowercase food names)
		for (const food of this.nutritionData) {
			const key = food.food.toLowerCase();
			if (!this._searchIndex[key]) {
				this._searchIndex[key] = food;
			}
		}
	}

	/**
	 * Parse a CSV file and return an array of food objects
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
					// Convert string numbers to actual numbers
					const processedData = {
						food: data.food,
						calories: parseFloat(data['Caloric Value']) || 0,
						protein: parseFloat(data.Protein) || 0,
						fat: parseFloat(data.Fat) || 0,
						carbs: parseFloat(data.Carbohydrates) || 0,
						fiber: parseFloat(data['Dietary Fiber']) || 0,
						calcium: parseFloat(data.Calcium) || 0,
						iron: parseFloat(data.Iron) || 0,
						vitaminA: parseFloat(data['Vitamin A']) || 0,
						vitaminC: parseFloat(data['Vitamin C']) || 0,
						vitaminD: parseFloat(data['Vitamin D']) || 0,
						vitaminB12: parseFloat(data['Vitamin B12']) || 0,
						folicAcid: parseFloat(data['Vitamin B11']) || 0, // Vitamin B11 is folic acid
						omega3: parseFloat(data['Polyunsaturated Fats']) || 0,
						sodium: parseFloat(data.Sodium) || 0,
						potassium: parseFloat(data.Potassium) || 0,
						magnesium: parseFloat(data.Magnesium) || 0,
						zinc: parseFloat(data.Zinc) || 0,
						nutritionDensity: parseFloat(data['Nutrition Density']) || 0
					};
					results.push(processedData);
				})
				.on('end', () => {
					resolve(results);
				})
				.on('error', (error) => {
					reject(error);
				});
		});
	}

	/**
	 * Get foods rich in specific nutrient (uses precomputed index)
	 * @param {string} nutrient - The nutrient to search for (e.g., 'iron', 'calcium', 'protein')
	 * @param {number} limit - Maximum number of results
	 * @returns {Array} Array of food objects sorted by nutrient content
	 */
	getFoodsRichIn(nutrient, limit = 10) {
		// Use precomputed index if available
		if (this._indexByNutrient[nutrient]) {
			return this._indexByNutrient[nutrient].slice(0, limit);
		}
		
		if (!this.nutritionData.length) {
			console.warn('⚠️ Nutrition data not loaded. Call loadNutritionData() first.');
			return [];
		}

		return this.nutritionData
			.filter(food => food[nutrient] > 0)
			.sort((a, b) => b[nutrient] - a[nutrient])
			.slice(0, limit);
	}

	/**
	 * Get foods that meet multiple nutrient criteria
	 * @param {Object} criteria - Object with nutrient names as keys and minimum values
	 * @param {number} limit - Maximum number of results
	 */
	getFoodsByMultipleCriteria(criteria, limit = 20) {
		if (!this.nutritionData.length) {
			return [];
		}

		return this.nutritionData
			.filter(food => {
				return Object.entries(criteria).every(([nutrient, minValue]) => {
					return food[nutrient] >= minValue;
				});
			})
			.sort((a, b) => b.nutritionDensity - a.nutritionDensity)
			.slice(0, limit);
	}

	/**
	 * Get high-protein foods suitable for pregnancy
	 */
	getHighProteinFoods(limit = 15) {
		return this.getFoodsRichIn('protein', limit);
	}

	/**
	 * Get calcium-rich foods
	 */
	getCalciumRichFoods(limit = 15) {
		return this.getFoodsRichIn('calcium', limit);
	}

	/**
	 * Get iron-rich foods
	 */
	getIronRichFoods(limit = 15) {
		return this.getFoodsRichIn('iron', limit);
	}

	/**
	 * Get folic acid-rich foods
	 */
	getFolicAcidRichFoods(limit = 15) {
		return this.getFoodsRichIn('folicAcid', limit);
	}

	/**
	 * Get foods by name search
	 */
	searchFoodsByName(searchTerm, limit = 10) {
		if (!this.nutritionData.length) {
			return [];
		}

		const searchLower = searchTerm.toLowerCase();
		return this.nutritionData
			.filter(food => food.food.toLowerCase().includes(searchLower))
			.slice(0, limit);
	}

	/**
	 * Get all nutrition data
	 */
	getAllData() {
		return this.nutritionData;
	}

	/**
	 * Create a comprehensive nutrient summary from the dataset
	 */
	getNutrientRecommendationsContext() {
		const ironFoods = this.getIronRichFoods(10);
		const calciumFoods = this.getCalciumRichFoods(10);
		const proteinFoods = this.getHighProteinFoods(10);
		const folicAcidFoods = this.getFolicAcidRichFoods(10);

		return {
			ironRichFoods: ironFoods.map(f => `${f.food} (${f.iron}mg iron)`),
			calciumRichFoods: calciumFoods.map(f => `${f.food} (${f.calcium}mg calcium)`),
			proteinRichFoods: proteinFoods.map(f => `${f.food} (${f.protein}g protein)`),
			folicAcidRichFoods: folicAcidFoods.map(f => `${f.food} (${f.folicAcid}mcg folic acid)`)
		};
	}
}

module.exports = NutritionDataLoader;
