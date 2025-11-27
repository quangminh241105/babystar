(function() {
  // Weight Chart
  const weightCtx = document.getElementById('weightChart');
  if (weightCtx) {
    new Chart(weightCtx, {
      type: 'line',
      data: {
        labels: ['Nov 16', 'Nov 15'],
        datasets: [{
          label: 'Weight (kg)',
          data: [68.5, 68],
          borderColor: '#FF6B9D',
          backgroundColor: 'rgba(255, 107, 157, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: false,
            min: 66,
            max: 71
          }
        }
      }
    });
  }

  // Sleep Chart
  const sleepCtx = document.getElementById('sleepChart');
  if (sleepCtx) {
    new Chart(sleepCtx, {
      type: 'line',
      data: {
        labels: ['Nov 16', 'Nov 15'],
        datasets: [{
          label: 'Sleep (hours)',
          data: [6.5, 6.5],
          borderColor: '#9f7aea',
          backgroundColor: 'rgba(159, 122, 234, 0.2)',
          tension: 0.4,
          fill: true,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 12
          }
        }
      }
    });
  }

  // Mood Chart
  const moodCtx = document.getElementById('moodChart');
  if (moodCtx) {
    new Chart(moodCtx, {
      type: 'bar',
      data: {
        labels: ['Good', 'Tired'],
        datasets: [
          {
            label: 'Number of occurrences',
            data: [1, 1],
            backgroundColor: '#4299e1',
            yAxisID: 'y'
          },
          {
            label: 'Average frequency',
            data: [0.5, 0.5],
            backgroundColor: '#f6ad55',
            type: 'line',
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            max: 1
          },
          y1: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            max: 0.6,
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }
})();
