const inputArea = document.getElementById("messageInput");
const ques1 = document.getElementById("ques1");
const ques2 = document.getElementById("ques2");
const ques3 = document.getElementById("ques3");
const ques4 = document.getElementById("ques4");
const chatBox = document.querySelector('.chatBox');
const messageForm = document.querySelector('#messageForm form');

function appendUserMessage(text) {
    const wrapper = document.createElement('div');
    wrapper.className = 'UserChatBubble';
    wrapper.innerHTML = `
        <div class="UserchatIcon"> 
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="purple" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-icon lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div class="chat">
            <div class="UserChatText">${text}</div>
            <div class="UserChatTime">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        </div>`;
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function appendAIMessage(text) {
    const wrapper = document.createElement('div');
    wrapper.className = 'AIChatBubble';
    wrapper.innerHTML = `
        <div class="AIchatIcon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bot-icon lucide-bot"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
        </div>
        <div class="chat">
            <div class="chatText">${text}</div>
            <div class="AIchatTime">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        </div>`;
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
}

ques1.addEventListener("click", event => { inputArea.value = event.target.textContent; })
ques2.addEventListener("click", event => { inputArea.value = event.target.textContent; })
ques3.addEventListener("click", event => { inputArea.value = event.target.textContent; })
ques4.addEventListener("click", event => { inputArea.value = event.target.textContent; })

messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = inputArea.value && inputArea.value.trim();
    if (!text) return;
    appendUserMessage(text);
    inputArea.value = '';

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            appendAIMessage('Sorry, something went wrong.');
            console.error('Chat error', err);
            return;
        }
        const data = await res.json();
        appendAIMessage(data.reply || 'No reply');
    } catch (err) {
        console.error('Fetch error', err);
        appendAIMessage('Network error. Please try again.');
    }
});