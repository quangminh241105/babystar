const inputArea = document.getElementById("messageInput");
const ques1 = document.getElementById("ques1");
const ques2 = document.getElementById("ques2");
const ques3 = document.getElementById("ques3");
const ques4 = document.getElementById("ques4");

ques1.addEventListener("click", event => {
    inputArea.value = event.target.textContent;
})

ques2.addEventListener("click", event => {
    inputArea.value = event.target.textContent;
})

ques3.addEventListener("click", event => {
    inputArea.value = event.target.textContent;
})

ques4.addEventListener("click", event => {
    inputArea.value = event.target.textContent;
})