(function() {
  // DOM Elements
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const mainContent = document.getElementById('mainContent');
  const errorTitle = document.getElementById('errorTitle');
  const errorMessage = document.getElementById('errorMessage');

  // Show loading
  function showLoading() {
    loadingState.classList.remove('hidden');
    errorState.classList.add('hidden');
    mainContent.classList.add('hidden');
  }

  // Show error
  function showError(title, message) {
    loadingState.classList.add('hidden');
    errorState.classList.remove('hidden');
    mainContent.classList.add('hidden');
    errorTitle.textContent = title;
    errorMessage.textContent = message;
  }

  // Show main content
  function showMainContent() {
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    mainContent.classList.remove('hidden');
  }

  // Load nutrition plan from weekly report
  async function loadNutritionPlan() {
    showLoading();
    
    try {
      const response = await fetch('/api/nutrition/weekly-plan');
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404 && data.message?.includes('due date')) {
          showError('Due Date Not Set', 'Please update your profile with your due date to generate a personalized nutrition plan.');
          return;
        }
        throw new Error(data.message || 'Failed to load nutrition plan');
      }

      if (data.success && data.data) {
        renderNutritionPlan(data.data);
        showMainContent();
      } else {
        throw new Error('Invalid data format');
      }
    } catch (error) {
      console.error('Error loading nutrition plan:', error);
      showError('Unable to Load Nutrition Plan', error.message || 'Please try again or generate a new plan.');
    }
  }

  // Generate new nutrition plan
  async function generateNewPlan() {
    showLoading();
    
    try {
      const response = await fetch('/api/nutrition/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404 && data.message?.includes('due date')) {
          showError('Due Date Not Set', 'Please update your profile with your due date to generate a personalized nutrition plan.');
          return;
        }
        throw new Error(data.message || 'Failed to generate nutrition plan');
      }

      if (data.success && data.data) {
        renderNutritionPlan(data.data);
        showMainContent();
      } else {
        throw new Error('Invalid data format');
      }
    } catch (error) {
      console.error('Error generating nutrition plan:', error);
      showError('Unable to Generate Plan', error.message || 'Please try again later.');
    }
  }

  // Render the nutrition plan
  function renderNutritionPlan(planData) {
    // Update AI badge description
    const aiBadgeDesc = document.getElementById('aiBadgeDescription');
    if (planData.pregnancyWeek) {
      aiBadgeDesc.textContent = `This meal plan is automatically tailored to week ${planData.pregnancyWeek} of your pregnancy, taking into account your logged symptoms and nutritional needs.`;
    }

    // Update page subtitle
    const pageSubtitle = document.getElementById('pageSubtitle');
    if (planData.pregnancyWeek) {
      pageSubtitle.textContent = `AI-customized nutrition guide for week ${planData.pregnancyWeek}`;
    }

    // Render daily targets
    renderDailyTargets(planData.dailyTargets);

    // Render weekly meal plan
    renderWeeklyMealPlan(planData.weeklyMeals);

    // Render nutrient focus areas
    if (planData.nutrientFocus && planData.nutrientFocus.length > 0) {
      renderNutrientFocus(planData.nutrientFocus);
    }
  }

  // Render daily nutrition targets
  function renderDailyTargets(targets) {
    const goalsGrid = document.getElementById('nutritionGoals');
    goalsGrid.innerHTML = '';

    if (!targets || Object.keys(targets).length === 0) {
      goalsGrid.innerHTML = '<p>No daily targets available</p>';
      return;
    }

    const targetConfig = {
      calories: { label: 'Calories', unit: 'per day', note: 'Energy needs' },
      protein: { label: 'Protein', unit: 'per day', note: "Baby's growth" },
      calcium: { label: 'Calcium', unit: 'per day', note: 'Bone development' },
      iron: { label: 'Iron', unit: 'per day', note: 'Prevents anemia' },
      folate: { label: 'Folate', unit: 'per day', note: 'Neural development' },
      dha: { label: 'DHA', unit: 'per day', note: 'Brain development' }
    };

    Object.entries(targets).forEach(([key, value]) => {
      const config = targetConfig[key.toLowerCase()] || { label: key, unit: 'per day', note: 'Nutritional support' };
      
      const card = document.createElement('div');
      card.className = 'goal-card';
      card.innerHTML = `
        <div class="goal-value">${value}</div>
        <div class="goal-label">${config.label}</div>
        <div class="goal-unit">${config.unit}</div>
        <div class="goal-note">${config.note}</div>
      `;
      goalsGrid.appendChild(card);
    });
  }

  // Render weekly meal plan
  function renderWeeklyMealPlan(weeklyMeals) {
    const container = document.getElementById('weeklyMealPlan');
    container.innerHTML = '';

    if (!weeklyMeals || weeklyMeals.length === 0) {
      container.innerHTML = '<p>No meal plan available</p>';
      return;
    }

    // Create day tabs
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'day-tabs';
    tabsContainer.style.cssText = 'display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;';

    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'day-content';

    weeklyMeals.forEach((day, index) => {
      // Create tab button
      const tabBtn = document.createElement('button');
      tabBtn.className = `day-tab ${index === 0 ? 'active' : ''}`;
      tabBtn.textContent = day.day || `Day ${index + 1}`;
      tabBtn.style.cssText = 'padding: 10px 20px; border: 2px solid #ff6b9d; background: white; color: #ff6b9d; border-radius: 6px; cursor: pointer; font-weight: 600;';
      tabBtn.onclick = () => showDay(index);
      tabsContainer.appendChild(tabBtn);

      // Create day content
      const dayDiv = document.createElement('div');
      dayDiv.className = `day-meals ${index === 0 ? 'active' : 'hidden'}`;
      dayDiv.dataset.day = index;

      // Render each meal type
      ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mealType => {
        if (day[mealType] && day[mealType].length > 0) {
          const mealSection = document.createElement('div');
          mealSection.className = 'meal-section';
          mealSection.style.marginBottom = '30px';

          const mealIcons = {
            breakfast: '🍳',
            lunch: '🍽️',
            dinner: '🍴',
            snacks: '🍎'
          };

          mealSection.innerHTML = `
            <h3 class="section-title">
              <span class="title-icon">${mealIcons[mealType]}</span>
              ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}
            </h3>
          `;

          const mealsGrid = document.createElement('div');
          mealsGrid.className = mealType === 'snacks' ? 'snacks-options-grid' : 'meal-options-grid';
          mealsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;';

          day[mealType].forEach(meal => {
            const mealCard = document.createElement('div');
            mealCard.className = mealType === 'snacks' ? 'snack-option-card' : 'meal-option-card';
            mealCard.style.cssText = 'background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';

            let alternatives = '';
            if (meal.alternatives && meal.alternatives.length > 0) {
              alternatives = `
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">
                  <small style="color: #666;">Alternatives: ${meal.alternatives.join(', ')}</small>
                </div>
              `;
            }

            mealCard.innerHTML = `
              <div class="${mealType === 'snacks' ? 'snack' : 'meal'}-option-name" style="font-weight: 600; margin-bottom: 10px; color: #333;">
                ${meal.food}
              </div>
              ${meal.portion ? `<div style="color: #666; margin-bottom: 8px;">Portion: ${meal.portion}</div>` : ''}
              ${meal.reason ? `<div style="color: #555; font-size: 14px; margin-bottom: 8px;">${meal.reason}</div>` : ''}
              <div class="${mealType === 'snacks' ? 'snack' : 'meal'}-option-footer" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                ${meal.calories ? `<span class="${mealType === 'snacks' ? 'snack' : 'meal'}-option-cal" style="color: #ff6b9d; font-weight: 600;">${meal.calories} cal</span>` : ''}
                ${meal.keyNutrients && meal.keyNutrients.length > 0 ? `<span class="${mealType === 'snacks' ? 'snack' : 'meal'}-option-tags" style="color: #666; font-size: 13px;">${meal.keyNutrients.join(', ')}</span>` : ''}
              </div>
              ${alternatives}
            `;
            mealsGrid.appendChild(mealCard);
          });

          mealSection.appendChild(mealsGrid);
          dayDiv.appendChild(mealSection);
        }
      });

      contentContainer.appendChild(dayDiv);
    });

    container.appendChild(tabsContainer);
    container.appendChild(contentContainer);

    // Show day function
    function showDay(index) {
      document.querySelectorAll('.day-tab').forEach((tab, i) => {
        if (i === index) {
          tab.style.background = '#ff6b9d';
          tab.style.color = 'white';
          tab.classList.add('active');
        } else {
          tab.style.background = 'white';
          tab.style.color = '#ff6b9d';
          tab.classList.remove('active');
        }
      });

      document.querySelectorAll('.day-meals').forEach((day, i) => {
        day.classList.toggle('hidden', i !== index);
        day.classList.toggle('active', i === index);
      });
    }
  }

  // Render nutrient focus areas
  function renderNutrientFocus(nutrientFocus) {
    const section = document.getElementById('nutrientFocusSection');
    const container = document.getElementById('nutrientFocus');
    
    section.style.display = 'block';
    container.innerHTML = '';

    const focusGrid = document.createElement('div');
    focusGrid.style.cssText = 'display: grid; gap: 15px; margin-top: 15px;';

    nutrientFocus.forEach(item => {
      const focusCard = document.createElement('div');
      focusCard.style.cssText = 'background: #fff8f0; border-left: 4px solid #ff6b9d; padding: 15px; border-radius: 6px;';
      focusCard.innerHTML = `
        <div style="font-weight: 600; color: #333; margin-bottom: 8px;">${item.nutrient}</div>
        <div style="color: #555; font-size: 14px; margin-bottom: 8px;">${item.reason}</div>
        ${item.sources && item.sources.length > 0 ? `<div style="color: #666; font-size: 13px;">Rich sources: ${item.sources.join(', ')}</div>` : ''}
      `;
      focusGrid.appendChild(focusCard);
    });

    container.appendChild(focusGrid);
  }

  // Make functions global so buttons can access them
  window.loadNutritionPlan = loadNutritionPlan;
  window.generateNewPlan = generateNewPlan;

  // Load nutrition plan on page load
  document.addEventListener('DOMContentLoaded', loadNutritionPlan);
})();
