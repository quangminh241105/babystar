(function() {
  // Add smooth scroll behavior
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Add click handler for meal cards (could expand to show more details)
  document.querySelectorAll('.meal-card').forEach(card => {
    card.addEventListener('click', function() {
      this.style.transform = 'scale(1.02)';
      setTimeout(() => {
        this.style.transform = '';
      }, 200);
    });
  });
})();
