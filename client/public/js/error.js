// add if any client-side JavaScript for error page here, after 5 sec, redirect to /
setTimeout(() => {
  window.location.href = '/';
}, 5000);

let countdownElement = document.getElementById('countdown');
let countdown = 5;
let interval = setInterval(() => {
  countdown--;
  if (countdownElement) {
    countdownElement.textContent = countdown;
  }
  if (countdown <= 0) {
    clearInterval(interval);
  }
}, 1000);