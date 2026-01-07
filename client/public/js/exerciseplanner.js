// DOM Elements - accessed globally
let loadingState, errorState, partnerErrorState, mainContent;
let currentViewUserId = null; // Track whose plan we're viewing
let isViewingPartner = false; // Track if viewing partner's plan

// Show loading
function showLoading() {
	loadingState.classList.remove('hidden');
	errorState.classList.add('hidden');
	partnerErrorState.classList.add('hidden');
	mainContent.classList.add('hidden');
}

// Show error/no plan
function showError(viewingPartner = false) {
	loadingState.classList.add('hidden');
	mainContent.classList.add('hidden');
	
	if (viewingPartner) {
		partnerErrorState.classList.remove('hidden');
		errorState.classList.add('hidden');
	} else {
		errorState.classList.remove('hidden');
		partnerErrorState.classList.add('hidden');
	}
}

// Show main content
function showMainContent() {
	loadingState.classList.add('hidden');
	errorState.classList.add('hidden');
	partnerErrorState.classList.add('hidden');
	mainContent.classList.remove('hidden');
}

// Generate new exercise plan
async function generateNewPlan() {
	if (!confirm('Are you sure you want to regenerate your exercise plan? This will replace your current plan.')) {
		return;
	}

	showLoading();

	try {
		const response = await fetch('/api/exercise/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ forceRegenerate: true })
		});

		const result = await response.json();

		if (response.ok && result.success && result.data) {
			console.log('✅ Exercise plan regenerated successfully');
			renderAIExercisePlan(result.data, mainContent, isViewingPartner);
			showMainContent();
		} else {
			throw new Error(result.message || 'Failed to regenerate exercise plan');
		}
	} catch (error) {
		console.error('❌ Error generating exercise plan:', error);
		CustomModal.alert('Failed to generate exercise plan: ' + error.message, { titleText: 'Error', danger: true });
		showError();
	}
}

// Load exercise data and render static-style UI on page load
document.addEventListener('DOMContentLoaded', async () => {
	// Initialize DOM elements
	loadingState = document.getElementById('loadingState');
	errorState = document.getElementById('errorState');
	partnerErrorState = document.getElementById('partnerErrorState');
	mainContent = document.getElementById('mainContent');
	
	showLoading();
	
	try {
		// Get partnerId from URL query params
		const urlParams = new URLSearchParams(window.location.search);
		const partnerId = urlParams.get('partnerId');
		
		let targetUserId = partnerId || null;
		isViewingPartner = !!partnerId;
		
		if (partnerId) {
			currentViewUserId = partnerId;
			console.log(`👥 Viewing partner's exercise plan (Partner ID: ${partnerId})`);
		} else {
			console.log('👤 Viewing own exercise plan');
		}
		
		// Build API URL with optional userId parameter
		const apiUrl = targetUserId 
			? `/api/exercise/weekly-plan?userId=${targetUserId}` 
			: '/api/exercise/weekly-plan';
		
		// Try to load AI exercise plan
		const response = await fetch(apiUrl);
		const result = await response.json();

		if (response.ok && result.success && result.data) {
			console.log('✅ Loaded AI exercise plan');
			
			// Check if plan has exercises
			const hasExercises = result.data.dailyExercisePlan?.some(day => 
				!day.restDay && day.exercises?.length > 0
			);
			
			if (!hasExercises) {
				console.warn('⚠️ Plan has no exercises');
				showError(isViewingPartner);
				return;
			}
			
			renderAIExercisePlan(result.data, mainContent, isViewingPartner);
			showMainContent();
		} else {
			console.log('⚠️ No AI plan found');
			showError(isViewingPartner);
		}
	} catch (error) {
		console.error('Error loading exercise plan:', error);
		showError(isViewingPartner);
	}
});

/**
 * Render AI-generated exercise plan in original static format
 */
function renderAIExercisePlan(plan, container, isViewingPartner = false) {
	// Check if plan has any actual exercises
	const hasExercises = plan.dailyExercisePlan?.some(day => 
		!day.restDay && day.exercises?.length > 0
	);
	
	if (!hasExercises) {
		console.warn('⚠️ Plan has no exercises');
		CustomModal.alert('No exercises found in plan. Please try regenerating.', { titleText: 'No Exercises' });
		return;
	}
	
	// Calculate weekly summary
	let totalActiveDays = 0;
	let totalMinutes = 0;
	let exerciseTypes = new Set();
	
	plan.dailyExercisePlan?.forEach(day => {
		if (!day.restDay && day.exercises?.length > 0) {
			totalActiveDays++;
			day.exercises.forEach(ex => {
				if (ex.category) exerciseTypes.add(ex.category);
				// Use durationMinutes from database or parse duration string
				const duration = ex.durationMinutes || ex.duration;
				if (typeof duration === 'number') {
					totalMinutes += duration;
				} else if (duration) {
					const match = String(duration).match(/(\d+)/);
					if (match) totalMinutes += parseInt(match[1]);
				}
			});
		}
	});
	
	const restDays = 7 - totalActiveDays;
	const focusAreas = plan.weeklyGoals?.focusAreas?.join(', ') || Array.from(exerciseTypes).slice(0, 3).join(', ');
	
	// Build weekly summary from AI
	const summaryReason = plan.summary?.planReason || `This plan is customized based on your current pregnancy week, recent health logs, energy levels, and symptoms.`;
	const weeklyFocus = plan.summary?.weeklyFocus || `It focuses on ${focusAreas} with ${totalActiveDays} active workout days and ${restDays} rest days.`;
	const keyBenefits = plan.summary?.keyBenefits || [];
	
	let benefitsHTML = '';
	if (keyBenefits.length > 0) {
		benefitsHTML = `<p class="goal-benefits"><strong>Key Benefits:</strong> ${keyBenefits.join(' • ')}</p>`;
	}
	
	// Build weekly summary
	const weeklySummaryHTML = `
		<section class="ai-badge">
			<div class="ai-icon">🤖</div>
			<div class="ai-text">
				<div class="ai-badge-header">
					<strong>AI-Personalized Exercise Plan</strong>
					<span class="ai-powered-tag">AI POWERED</span>
				</div>
				<p>${summaryReason} ${weeklyFocus}</p>
				${benefitsHTML}
			</div>
		</section>
	`;
	
	// Build weekly schedule from AI data
	let weeklyScheduleHTML = '';
	const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
	
	days.forEach(day => {
		const dayPlan = plan.dailyExercisePlan?.find(d => d.day === day);
		let exercisesHTML = '';
		
		if (dayPlan && !dayPlan.restDay && dayPlan.exercises?.length > 0) {
			exercisesHTML = dayPlan.exercises.map(ex => {
				const duration = ex.durationMinutes || ex.duration;
				const durationText = duration ? (typeof duration === 'number' ? `${duration} min` : duration) : '';
				return `<div class="activity-item">${durationText ? durationText + ' ' : ''}${ex.name}</div>`;
			}).join('');
		} else if (dayPlan && dayPlan.restDay) {
			exercisesHTML = '<div class="activity-item">Rest Day or Gentle Stretching</div>';
		} else {
			exercisesHTML = '<div class="activity-item">No exercises scheduled</div>';
		}
		
		const isRestDay = dayPlan?.restDay || !dayPlan || dayPlan.exercises?.length === 0;
		const dayClass = isRestDay ? 'day-card rest-day' : 'day-card';
		
		weeklyScheduleHTML += `
			<div class="${dayClass}">
				<div class="day-header">${day}</div>
				<div class="day-activities">${exercisesHTML}</div>
			</div>
		`;
	});
	
	// Build recommended exercises from AI data
	let recommendedHTML = '';
	const uniqueExercises = new Map();
	
	plan.dailyExercisePlan?.forEach(day => {
		day.exercises?.forEach(ex => {
			if (!uniqueExercises.has(ex.name)) {
				uniqueExercises.set(ex.name, ex);
			}
		});
	});
	
	uniqueExercises.forEach(ex => {
		const tips = [];
		if (ex.instructions) {
			// Split instructions into bullet points
			const sentences = ex.instructions.split(/\.\s+/).filter(s => s.trim());
			tips.push(...sentences.slice(0, 4).map(s => s.trim()));
		}
		if (ex.modifications) {
			tips.push(ex.modifications);
		}
		
		const duration = ex.durationMinutes || ex.duration;
		const durationText = duration ? (typeof duration === 'number' ? `${duration} min` : duration) : '';
		
		recommendedHTML += `
			<div class="exercise-card">
				<div class="exercise-header">
					<div class="exercise-title-group">
						<h3>${ex.name}</h3>
						<div class="exercise-meta">
							${durationText ? `<span class="exercise-duration">${durationText}</span>` : ''}
							${durationText && ex.sets ? '<span class="exercise-separator">•</span>' : ''}
							${ex.sets && ex.reps ? `<span class="exercise-frequency">${ex.sets} sets × ${ex.reps} reps</span>` : ''}
						</div>
					</div>
					<div class="exercise-benefit">${ex.category || ''}</div>
				</div>
				${tips.length > 0 ? `
					<ul class="exercise-tips">
						${tips.map(tip => `<li>${tip}</li>`).join('')}
					</ul>
				` : ''}
			</div>
		`;
	});
	
	// Build safety guidelines
	const safetyHTML = (plan.safetyGuidelines || [
		'Always warm up before and cool down after exercise',
		'Stay hydrated - drink water before, during, and after',
		'Avoid overheating - exercise in cool, well-ventilated areas',
		'Stop if you experience dizziness, shortness of breath, or pain',
		'Avoid contact sports and activities with fall risk',
		'Don\'t exercise to the point of exhaustion',
		'Listen to your body and modify as needed',
		'Consult your healthcare provider before starting any new routine'
	]).map(tip => `<div class="safety-item">⚠️ ${tip}</div>`).join('');
	
	// Build regenerate button HTML (only show if viewing own plan)
	const regenerateButtonHTML = !isViewingPartner ? `
		<button onclick="generateNewPlan()" style="
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			border: none;
			padding: 12px 30px;
			font-size: 16px;
			border-radius: 8px;
			cursor: pointer;
			box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
			transition: transform 0.2s;
			margin-top: 15px;
		" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
			🔄 Regenerate Exercise Plan
		</button>
	` : '';
	
	container.innerHTML = `
		<!-- AI Weekly Summary -->
		${weeklySummaryHTML}
		
		<!-- Page Header -->
		<header class="page-header">
			<h1>Personalized Exercise Plan</h1>
			<p class="subtitle">Safe and effective workouts for your pregnancy</p>
			${regenerateButtonHTML}
		</header>

		<!-- Weekly Goal -->
		<section class="goal-banner">
			<h2 class="goal-title">💪 Weekly Exercise Goal</h2>
			<p class="goal-description">
				${plan.weeklyGoals?.description || 'Build and maintain fitness throughout your pregnancy'}
			</p>
			<p class="goal-description">
				Aim for <strong>${plan.weeklyGoals?.totalMinutes || 150} minutes</strong> 
				of ${plan.weeklyGoals?.intensityLevel || 'moderate-intensity'} aerobic activity per week, 
				spread over <strong>${plan.weeklyGoals?.daysPerWeek || 5} days</strong>.
			</p>
			<p class="goal-benefits">
				${plan.weeklyGoals?.benefits || 'Regular exercise during pregnancy can help reduce back pain, prevent excess weight gain, improve sleep, and prepare your body for labor and delivery.'}
			</p>
			${plan.weeklyGoals?.cautionNote ? `<p class="goal-caution">⚠️ ${plan.weeklyGoals.cautionNote}</p>` : ''}
		</section>

		<!-- Recommended Exercises -->
		<section class="exercises-section">
			<h2 class="section-title">
				<span class="title-icon">🏃‍♀️</span>
				Recommended Exercises
			</h2>
			${recommendedHTML}
		</section>

		<!-- Weekly Schedule -->
		<section class="schedule-section">
			<h2 class="section-title">
				<span class="title-icon">📅</span>
				Suggested Weekly Schedule
			</h2>
			<p class="section-subtitle">A balanced routine for the week</p>
			<div class="schedule-grid">
				${weeklyScheduleHTML}
			</div>
		</section>

		<!-- Safety Guidelines -->
		<section class="safety-section">
			<h2 class="section-title warning">
				<span class="title-icon">⚠️</span>
				Safety Guidelines
			</h2>
			<p class="section-subtitle">Important precautions for exercising during pregnancy</p>
			<div class="safety-grid">
				${safetyHTML}
			</div>
		</section>

		<!-- When to Stop -->
		<section class="emergency-section">
			<h2 class="section-title emergency">
				<span class="title-icon">🚨</span>
				When to Stop Exercising Immediately
			</h2>
			<p class="emergency-subtitle">Contact your healthcare provider if you experience any of these symptoms:</p>
			<div class="emergency-list">
				<div class="emergency-item">• Vaginal bleeding</div>
				<div class="emergency-item">• Dizziness or feeling faint</div>
				<div class="emergency-item">• Chest pain</div>
				<div class="emergency-item">• Headache</div>
				<div class="emergency-item">• Muscle weakness</div>
				<div class="emergency-item">• Calf pain or swelling</div>
				<div class="emergency-item">• Regular painful contractions</div>
				<div class="emergency-item">• Fluid leaking from vagina</div>
			</div>
		</section>
	`;
}

