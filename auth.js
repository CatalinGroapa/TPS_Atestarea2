(() => {
    const auth = firebase.auth();
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showLoginBtn = document.getElementById('showLogin');
    const showRegisterBtn = document.getElementById('showRegister');
    const messageEl = document.getElementById('authMessage');
    const googleLoginBtn = document.getElementById('googleLoginBtn');

    function setMessage(text, type = '') {
        messageEl.textContent = text || '';
        messageEl.className = 'auth-message';
        if (type) messageEl.classList.add(type);
    }

    function showLogin() {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        showLoginBtn.classList.add('active');
        showRegisterBtn.classList.remove('active');
        setMessage('');
    }

    function showRegister() {
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        showRegisterBtn.classList.add('active');
        showLoginBtn.classList.remove('active');
        setMessage('');
    }

    showLoginBtn.addEventListener('click', showLogin);
    showRegisterBtn.addEventListener('click', showRegister);

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setMessage('');

        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value;

        try {
            await auth.signInWithEmailAndPassword(email, password);
            setMessage('Autentificare reusita. Redirect...', 'success');
            setTimeout(() => (window.location.href = 'index.html'), 350);
        } catch (error) {
            setMessage(`Login esuat: ${error.message}`, 'error');
        }
    });

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setMessage('');

        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim().toLowerCase();
        const password = document.getElementById('registerPassword').value;
        const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

        if (name.length < 2) {
            setMessage('Numele este prea scurt.', 'error');
            return;
        }
        if (password.length < 6) {
            setMessage('Parola trebuie sa aiba minim 6 caractere.', 'error');
            return;
        }
        if (password !== passwordConfirm) {
            setMessage('Parolele nu coincid.', 'error');
            return;
        }

        try {
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            if (cred.user) {
                await cred.user.updateProfile({ displayName: name });
            }
            setMessage('Cont creat. Redirect...', 'success');
            setTimeout(() => (window.location.href = 'index.html'), 350);
        } catch (error) {
            setMessage(`Inregistrare esuata: ${error.message}`, 'error');
        }
    });

    googleLoginBtn.addEventListener('click', async () => {
        setMessage('');
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            await auth.signInWithPopup(provider);
            setMessage('Login Google reusit. Redirect...', 'success');
            setTimeout(() => (window.location.href = 'index.html'), 250);
        } catch (error) {
            setMessage(`Google login esuat: ${error.message}`, 'error');
        }
    });

    auth.onAuthStateChanged((user) => {
        if (user) {
            window.location.href = 'index.html';
        }
    });
})();
