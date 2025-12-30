(function() {
  'use strict';

  // Get logs data from script tag
  const logsDataEl = document.getElementById('logsData');
  const allLogs = logsDataEl ? JSON.parse(logsDataEl.textContent) : [];
  
  // Get all log cards
  const allLogCards = Array.from(document.querySelectorAll('.log-card'));
  
  // Get filter elements
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const detailContent = document.getElementById('detailContent');

  // Filter function
  function filterLogs() {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    
    let visibleCount = 0;
    
    allLogCards.forEach(card => {
      const logDate = card.dataset.logDate;
      
      if (!logDate) {
        card.style.display = '';
        visibleCount++;
        return;
      }
      
      let show = true;
      
      // Check start date
      if (startDate && logDate < startDate) {
        show = false;
      }
      
      // Check end date
      if (endDate && logDate > endDate) {
        show = false;
      }
      
      card.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });

    // Show/hide no results message
    updateNoResultsMessage(visibleCount);
  }

  // Update no results message
  function updateNoResultsMessage(visibleCount) {
    const logsList = document.getElementById('logsList');
    let noResultsMsg = logsList.querySelector('.no-results-filter');
    
    if (visibleCount === 0 && allLogCards.length > 0) {
      if (!noResultsMsg) {
        noResultsMsg = document.createElement('div');
        noResultsMsg.className = 'no-logs no-results-filter';
        noResultsMsg.innerHTML = '<p>No health logs found for the selected date range. Try adjusting your filters.</p>';
        logsList.appendChild(noResultsMsg);
      }
      noResultsMsg.style.display = 'block';
    } else if (noResultsMsg) {
      noResultsMsg.style.display = 'none';
    }
  }

  // Quick filter buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const range = btn.dataset.range;
      const today = new Date();
      
      // Remove active class from all buttons
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      if (range === 'all') {
        startDateInput.value = '';
        endDateInput.value = '';
      } else {
        const days = parseInt(range);
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - days);
        
        startDateInput.value = startDate.toISOString().split('T')[0];
        endDateInput.value = today.toISOString().split('T')[0];
      }
      
      filterLogs();
    });
  });

  // Date input listeners
  if (startDateInput) {
    startDateInput.addEventListener('change', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      filterLogs();
    });
  }
  
  if (endDateInput) {
    endDateInput.addEventListener('change', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      filterLogs();
    });
  }

  // Handle log card selection
  allLogCards.forEach(card => {
    card.addEventListener('click', () => {
      // Remove selected class from all cards
      allLogCards.forEach(c => c.classList.remove('selected'));
      
      // Add selected class to clicked card
      card.classList.add('selected');
      
      // Check the radio button
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
      }
      
      // Load detail view
      const logIndex = parseInt(card.dataset.logIndex);
      loadLogDetail(logIndex);
    });
  });

  // Load log detail
  function loadLogDetail(index) {
    if (!allLogs || !allLogs[index]) return;
    
    const log = allLogs[index];
    const logDate = new Date(log.logDate);
    const formattedDate = logDate.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    const isoDate = logDate.toISOString().split('T')[0];
    const logId = log._id || log.id;
    const today = new Date().toISOString().split('T')[0];
    const isToday = isoDate === today;
    
    // Build detail HTML
    let detailHTML = `
      <div class="detail-header">
        <h3 class="detail-title">Daily Health Log</h3>
        <div class="detail-subtitle">${formattedDate}</div>
        <div class="detail-id">Log ID: #${logId.toString().slice(-6)}</div>
      </div>
      
      <div class="detail-body">
        ${generateDetailSections(log)}
      </div>
      
      <div class="detail-actions">
        ${isToday ? `
          <a href="/health-log" class="action-button edit-btn">
            Edit Today's Log
          </a>
        ` : ''}
        <form method="POST" action="/past-health-records/${logId}/delete" class="delete-form">
          <button type="submit" class="action-button delete-btn">
            Delete Log
          </button>
        </form>
      </div>
    `;
    
    detailContent.innerHTML = detailHTML;
  }

  // Generate detail sections from log data
  function generateDetailSections(log) {
    let html = '';
    
    // Helper function to replace underscores
    const formatText = (text) => text ? text.replace(/_/g, ' ') : '';
    
    // Vitals Section
    if (log.weightKg || log.heartRateBpm || (log.bloodPressure && (log.bloodPressure.systolic || log.bloodPressure.diastolic))) {
      html += `<div class="detail-section">
        <h4 class="section-title">📊 Health Metrics</h4>
        <div class="metrics-grid">`;
      
      if (log.weightKg) {
        html += `<div class="metric-card">
          <div class="metric-label">Weight</div>
          <div class="metric-value">${log.weightKg} kg</div>
        </div>`;
      }
      
      if (log.heartRateBpm) {
        html += `<div class="metric-card">
          <div class="metric-label">Heart Rate</div>
          <div class="metric-value">${log.heartRateBpm} bpm</div>
        </div>`;
      }
      
      if (log.bloodPressure && (log.bloodPressure.systolic || log.bloodPressure.diastolic)) {
        html += `<div class="metric-card">
          <div class="metric-label">Blood Pressure</div>
          <div class="metric-value">${log.bloodPressure.systolic || '-'}/${log.bloodPressure.diastolic || '-'} mmHg</div>
          <div class="metric-status normal">Normal</div>
        </div>`;
      }
      
      html += `</div></div>`;
    }
    
    // Sleep Section
    if (log.sleep && (log.sleep.totalHours || log.sleep.quality)) {
      html += `<div class="detail-section">
        <h4 class="section-title">😴 Sleep</h4>
        <div class="metrics-grid">`;
      
      if (log.sleep.totalHours) {
        html += `<div class="metric-card">
          <div class="metric-label">Total Hours</div>
          <div class="metric-value">${log.sleep.totalHours} hrs</div>
        </div>`;
      }
      
      if (log.sleep.quality) {
        html += `<div class="metric-card">
          <div class="metric-label">Quality</div>
          <div class="metric-value">${log.sleep.quality}/5</div>
        </div>`;
      }
      
      html += `</div></div>`;
    }
    
    // Mood Section
    if ((log.moodLog && log.moodLog.length > 0) || log.energyLevel || log.stressLevel) {
      html += `<div class="detail-section">
        <h4 class="section-title">😊 Mood & Wellbeing</h4>`;
      
      if (log.moodLog && log.moodLog.length > 0) {
        html += `<div class="mood-items">`;
        log.moodLog.forEach(mood => {
          html += `<div class="mood-item">
            <span class="mood-badge">${formatText(mood.mood)}</span>
            ${mood.trigger ? `<span class="mood-trigger">${mood.trigger}</span>` : ''}
          </div>`;
        });
        html += `</div>`;
      }
      
      if (log.energyLevel || log.stressLevel) {
        html += `<div class="metrics-grid">`;
        if (log.energyLevel) {
          html += `<div class="metric-card">
            <div class="metric-label">Energy Level</div>
            <div class="metric-value">${log.energyLevel}/5</div>
          </div>`;
        }
        if (log.stressLevel) {
          html += `<div class="metric-card">
            <div class="metric-label">Stress Level</div>
            <div class="metric-value">${log.stressLevel}/5</div>
          </div>`;
        }
        html += `</div>`;
      }
      
      html += `</div>`;
    }
    
    // Symptoms Section
    if (log.symptoms && log.symptoms.length > 0) {
      html += `<div class="detail-section">
        <h4 class="section-title">🩺 Symptoms</h4>
        <ul class="symptom-list">`;
      log.symptoms.forEach(symptom => {
        html += `<li class="symptom-item">
          <div class="symptom-header">
            <strong>${formatText(symptom.symptom)}</strong>
            <span class="severity-badge">Severity: ${symptom.severity}/10</span>
          </div>
          ${symptom.notes ? `<p class="symptom-note">${symptom.notes}</p>` : ''}
        </li>`;
      });
      html += `</ul></div>`;
    }
    
    // Exercise Section
    if (log.exercises && log.exercises.length > 0) {
      html += `<div class="detail-section">
        <h4 class="section-title">🏃 Exercise</h4>
        <ul class="exercise-list">`;
      log.exercises.forEach(exercise => {
        html += `<li class="exercise-item">
          <div class="exercise-header">
            <strong>${formatText(exercise.type)}</strong>
            ${exercise.durationMinutes ? `<span class="exercise-duration">${exercise.durationMinutes} min</span>` : ''}
          </div>
          <div class="exercise-details">
            ${exercise.intensity ? `<span class="exercise-tag">Intensity: ${exercise.intensity}</span>` : ''}
            ${exercise.feeling ? `<span class="exercise-tag">Feeling: ${exercise.feeling}</span>` : ''}
          </div>
          ${exercise.notes ? `<p class="exercise-note">${exercise.notes}</p>` : ''}
        </li>`;
      });
      html += `</ul></div>`;
    }
    
    // Nutrition Section
    if (log.foodIntake && log.foodIntake.length > 0) {
      html += `<div class="detail-section">
        <h4 class="section-title">🍽️ Nutrition</h4>`;
      log.foodIntake.forEach(meal => {
        html += `<div class="meal-item">
          <div class="meal-header">${formatText(meal.mealType)}</div>`;
        if (meal.foods && meal.foods.length > 0) {
          html += `<ul class="food-list">`;
          meal.foods.forEach(food => {
            html += `<li>${food.name}${food.amount ? ` - ${food.amount} ${food.unit}` : ''}</li>`;
          });
          html += `</ul>`;
        }
        if (meal.notes) {
          html += `<p class="meal-note">${meal.notes}</p>`;
        }
        html += `</div>`;
      });
      html += `</div>`;
    }
    
    // Hydration Section
    if (log.hydration && (log.hydration.waterLiters > 0 || log.hydration.otherFluidsLiters > 0)) {
      html += `<div class="detail-section">
        <h4 class="section-title">💧 Hydration</h4>
        <div class="metrics-grid">`;
      if (log.hydration.waterLiters > 0) {
        html += `<div class="metric-card">
          <div class="metric-label">Water Intake</div>
          <div class="metric-value">${log.hydration.waterLiters} L</div>
        </div>`;
      }
      if (log.hydration.otherFluidsLiters > 0) {
        html += `<div class="metric-card">
          <div class="metric-label">Other Fluids</div>
          <div class="metric-value">${log.hydration.otherFluidsLiters} L</div>
        </div>`;
      }
      html += `</div></div>`;
    }
    
    // Fetal Movement
    if (log.fetalMovement && log.fetalMovement.count) {
      html += `<div class="detail-section">
        <h4 class="section-title">👶 Fetal Movement</h4>
        <div class="metric-card">
          <div class="metric-label">Kick Count</div>
          <div class="metric-value">${log.fetalMovement.count}</div>
        </div>
        ${log.fetalMovement.notes ? `<p class="detail-note">${log.fetalMovement.notes}</p>` : ''}
      </div>`;
    }
    
    // Doctor Visit
    if (log.doctorVisit && log.doctorVisit.visited) {
      html += `<div class="detail-section">
        <h4 class="section-title">👨‍⚕️ Doctor Visit</h4>`;
      if (log.doctorVisit.visitType) {
        html += `<p><strong>Type:</strong> ${formatText(log.doctorVisit.visitType)}</p>`;
      }
      if (log.doctorVisit.notes) {
        html += `<p><strong>Notes:</strong> ${log.doctorVisit.notes}</p>`;
      }
      html += `</div>`;
    }
    
    // General Notes
    if (log.notes) {
      html += `<div class="detail-section">
        <h4 class="section-title">📝 General Notes</h4>
        <p class="general-notes">${log.notes}</p>
      </div>`;
    }
    
    return html || '<p class="detail-note">No detailed data available for this log.</p>';
  }

  // Initialize - load first log if available
  if (allLogs && allLogs.length > 0) {
    loadLogDetail(0);
  }
  
  // Initialize filters
  filterLogs();
})();
