document.getElementById('send-btn').addEventListener('click', async () => {
    const inputField = document.getElementById('user-input');
    const text = inputField.value.trim();
    if (!text) return;

    appendMessage('You', text, 'user');
    inputField.value = '';

    // In a real hackathon, we would query activeTab here to get page context
    // and send it along with the message.

    try {
        const response = await fetch('http://localhost:8000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: "hackathon_user", 
                message: text,
                platform: "firefox"
            })
        });
        
        const data = await response.json();
        appendMessage('Agent', data.response_text, 'agent');
    } catch (error) {
        appendMessage('System', 'Error connecting to local server.', 'agent');
    }
});

function appendMessage(sender, text, className) {
    const chatBox = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg ' + className;
    msgDiv.innerHTML = `<span>${sender}: </span>${text}`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}
