const STORAGE_KEYS = {
    sessionToken: "honodadlc_session_token",
    festiveParticles: "honodadlc_festive_particles",
    theme: "honodadlc_theme"
};

const API_BASE = "/api";
const AVAILABLE_ROLES = ["Admin", "YouTube", "Alpha", "Tester", "TikTok", "User"];
const MAINTENANCE_MESSAGE = "Извините, сайт на технических работах! Попробуйте войти позже!";
const ALPHA_DOWNLOAD_FILENAME = "honoda-alpha.jar";
// On the website UI, only jars are admin-only. Loader must be public for everyone.
const ADMIN_ONLY_FILES = new Set(["honoda-2.0.jar", "honoda-alpha.jar"]);
const PUBLIC_LOADER_FILES = new Set(["honodaloader.zip"]);
const PUBLIC_LOADER_DEFAULT = "HonodaLoader.zip";
const LAUNCH_DATE = new Date("2026-03-24T00:00:00Z");
const state = {
    currentUser: null,
    users: [],
    festiveEnabled: loadFestiveEnabled(),
    maintenanceEnabled: false,
    freeDownloadEnabled: false,
    downloadInProgress: false,
    theme: loadTheme()
};

const elements = {
    authNavButton: document.getElementById("authNavButton"),
    themeToggleButton: document.getElementById("themeToggleButton"),
    loginModal: document.getElementById("loginModal"),
    dashboardModal: document.getElementById("dashboardModal"),
    userManageModal: document.getElementById("userManageModal"),
    keyManageModal: document.getElementById("keyManageModal"),
    allKeysModal: document.getElementById("allKeysModal"),
    showLoginTab: document.getElementById("showLoginTab"),
    showRegisterTab: document.getElementById("showRegisterTab"),
    loginForm: document.getElementById("loginForm"),
    registerForm: document.getElementById("registerForm"),
    logoutButton: document.getElementById("logoutButton"),
    userManageButton: document.getElementById("userManageButton"),
    createKeyButton: document.getElementById("createKeyButton"),
    viewAllKeysButton: document.getElementById("viewAllKeysButton"),
    refreshRolesButton: document.getElementById("refreshRolesButton"),
    deleteAllKeysButton: document.getElementById("deleteAllKeysButton"),
    userManageList: document.getElementById("userManageList"),
    userManageTotal: document.getElementById("userManageTotal"),
    allKeysList: document.getElementById("allKeysList"),
    allKeysTotal: document.getElementById("allKeysTotal"),
    keyCreateForm: document.getElementById("keyCreateForm"),
    createdKeyResult: document.getElementById("createdKeyResult"),
    showActiveKeysButton: document.getElementById("showActiveKeysButton"),
    activeKeysList: document.getElementById("activeKeysList"),
    keyInput: document.getElementById("keyInput"),
    activateKeyButton: document.getElementById("activateKeyButton"),
    keyStatusText: document.getElementById("keyStatusText"),
    downloadFilesSection: document.getElementById("downloadFilesSection"),
    downloadAccessState: document.getElementById("downloadAccessState"),
    downloadProgress: document.getElementById("downloadProgress"),
    downloadProgressBar: document.getElementById("downloadProgressBar"),
    downloadProgressText: document.getElementById("downloadProgressText"),
    maintenanceToggleButton: document.getElementById("maintenanceToggleButton"),
    maintenanceStatusText: document.getElementById("maintenanceStatusText"),
    downloadGateToggleButton: document.getElementById("downloadGateToggleButton"),
    profileName: document.getElementById("profileName"),
    profileMeta: document.getElementById("profileMeta"),
    festiveToggleButton: document.getElementById("festiveToggleButton"),
    festiveLayer: document.getElementById("festiveLayer"),
    statDownloads: document.getElementById("statDownloads"),
    homeDownloads: document.getElementById("homeDownloads"),
    statUid: document.getElementById("statUid"),
    statRole: document.getElementById("statRole"),
    globalDownloads: document.getElementById("globalDownloads"),
    daysSinceLaunch: document.getElementById("daysSinceLaunch"),
    maintenanceBlocker: document.getElementById("maintenanceBlocker"),
    maintenanceBlockerMessage: document.getElementById("maintenanceBlockerMessage"),
    maintenanceAdminLoginButton: document.getElementById("maintenanceAdminLoginButton"),
    toastContainer: document.getElementById("toastContainer"),
    publicLoaderDownloadButton: document.getElementById("publicLoaderDownloadButton")
};

let festiveTimerId = null;

init();

let roleUpdateInterval = null;

async function init() {
    bindEvents();
    initFeatureAnimations();
    renderFestiveToggle();
    applyTheme();
    showAuthView("login");
    await restoreSession();
    await refreshSiteStatus();
    setAuthButtonLabel();
    updateHomeDownloadsDisplay();
    updateDaysSinceLaunch();
    await loadGlobalStats();
    
    // Запускаем обновление времени ролей каждую минуту
    startRoleTimeUpdates();

    // Public loader download (no login required).
    if (elements.publicLoaderDownloadButton) {
        elements.publicLoaderDownloadButton.addEventListener("click", (event) => {
            event.preventDefault();
            downloadPublicLoader(PUBLIC_LOADER_DEFAULT);
        });
    }
}

function startRoleTimeUpdates() {
    if (roleUpdateInterval) {
        clearInterval(roleUpdateInterval);
    }
    
    roleUpdateInterval = setInterval(async () => {
        // Обновляем отображение времени в личном кабинете
        if (state.currentUser && elements.dashboardModal.classList.contains("is-open")) {
            // Обновляем данные пользователя для актуального кулдауна
            try {
                const data = await apiRequest("/auth/session", { method: "GET", auth: true });
                if (data.user) {
                    setCurrentUser(data.user);
                    renderDashboard(data.user);
                }
            } catch (error) {
                // Если не удалось обновить данные, просто обновляем UI с текущими данными
                renderDashboard(state.currentUser);
            }
        }
        
        // Обновляем отображение времени в панели управления
        if (elements.userManageModal.classList.contains("is-open")) {
            renderUserManageList();
        }
    }, 60000); // Каждую минуту
}

function bindEvents() {
    elements.authNavButton.addEventListener("click", () => {
        if (state.currentUser) {
            openDashboardModal();
        } else {
            openLoginModal();
        }
    });

    elements.showLoginTab.addEventListener("click", () => showAuthView("login"));
    elements.showRegisterTab.addEventListener("click", () => showAuthView("register"));

    elements.loginForm.addEventListener("submit", onLoginSubmit);
    elements.registerForm.addEventListener("submit", onRegisterSubmit);
    elements.logoutButton.addEventListener("click", onLogout);

    elements.userManageButton?.addEventListener("click", onUserManageOpen);
    elements.createKeyButton?.addEventListener("click", onCreateKeyOpen);
    elements.viewAllKeysButton?.addEventListener("click", onViewAllKeysOpen);
    elements.refreshRolesButton?.addEventListener("click", onRefreshRolesClick);
    elements.deleteAllKeysButton?.addEventListener("click", onDeleteAllKeysClick);
    elements.keyCreateForm?.addEventListener("submit", onCreateKeySubmit);
    elements.showActiveKeysButton?.addEventListener("click", onShowActiveKeys);
    elements.activateKeyButton?.addEventListener("click", onActivateKey);
    elements.festiveToggleButton?.addEventListener("click", onFestiveToggleClick);
    elements.themeToggleButton?.addEventListener("click", onThemeToggleClick);
    elements.maintenanceToggleButton?.addEventListener("click", onMaintenanceToggleClick);
    elements.downloadGateToggleButton?.addEventListener("click", onDownloadGateToggleClick);
    elements.maintenanceAdminLoginButton?.addEventListener("click", onMaintenanceAdminLoginClick);

    elements.keyInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            onActivateKey();
        }
    });

    document.querySelectorAll("[data-close-modal]").forEach((button) => {
        button.addEventListener("click", closeAllModals);
    });

    [elements.loginModal, elements.dashboardModal, elements.userManageModal, elements.keyManageModal, elements.allKeysModal].forEach((modal) => {
        if (!modal) return;
        modal.addEventListener("click", (event) => {
            if (event.target === modal) {
                closeAllModals();
            }
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeAllModals();
        }
    });

    document.querySelectorAll(".nav__link").forEach((link) => {
        link.addEventListener("click", (event) => {
            const href = link.getAttribute("href");
            if (!href || !href.startsWith("#")) return;
            event.preventDefault();
            document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });

    document.querySelectorAll(".download-button").forEach((button) => {
        button.addEventListener("click", () => {
            const filename = button.dataset.file || "";
            handleDownload(filename, button);
        });
    });
}

async function restoreSession() {
    const token = getSessionToken();
    if (!token) {
        setCurrentUser(null);
        return;
    }

    try {
        const data = await apiRequest("/auth/session", { method: "GET", auth: true });
        setCurrentUser(data.user || null);
    } catch {
        clearSessionToken();
        setCurrentUser(null);
    }
}

async function onLoginSubmit(event) {
    event.preventDefault();

    const formData = new FormData(elements.loginForm);
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");

    try {
        const data = await apiRequest("/auth/login", {
            method: "POST",
            auth: false,
            body: { username, password }
        });

        setSessionToken(data.token);
        setCurrentUser(data.user);
        await refreshSiteStatus();

        elements.loginForm.reset();
        closeAllModals();
        openDashboardModal();
        showToast("Успешный вход", "success");
    } catch (error) {
        showToast(getErrorMessage(error, "Ошибка входа"), "error");
    }
}

async function onRegisterSubmit(event) {
    event.preventDefault();

    const formData = new FormData(elements.registerForm);
    const username = String(formData.get("username") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (password !== confirmPassword) {
        showToast("Пароли не совпадают", "error");
        return;
    }

    try {
        const data = await apiRequest("/auth/register", {
            method: "POST",
            auth: false,
            body: { username, email, password }
        });

        elements.registerForm.reset();
        showAuthView("login");
        showToast(data.message || "Регистрация успешна", "success");
    } catch (error) {
        showToast(getErrorMessage(error, "Ошибка регистрации"), "error");
    }
}

async function onLogout() {
    try {
        await apiRequest("/auth/logout", { method: "POST", auth: true });
    } catch {
        // ignore network/logout errors
    }

    clearSessionToken();
    setCurrentUser(null);
    setKeyStatus("", "");
    if (elements.keyInput) {
        elements.keyInput.value = "";
    }
    closeAllModals();
    await refreshSiteStatus();
    showToast("Вы вышли из аккаунта", "success");
}

function openLoginModal() {
    showAuthView("login");
    openModal(elements.loginModal);
}

async function openDashboardModal() {
    if (!state.currentUser) {
        openLoginModal();
        return;
    }

    try {
        const data = await apiRequest("/auth/session", { method: "GET", auth: true });
        setCurrentUser(data.user || null);
    } catch (error) {
        if (isUnauthorized(error)) {
            await handleLostSession();
            return;
        }
        showToast(getErrorMessage(error, "Ошибка загрузки профиля"), "error");
        return;
    }

    const user = state.currentUser;
    if (!user) {
        openLoginModal();
        return;
    }

    const siteStatus = await refreshSiteStatus();
    if (siteStatus?.maintenanceEnabled && !siteStatus?.canAccess) {
        closeAllModals();
        return;
    }

    if (user.banned) {
        showToast("Ваш аккаунт заблокирован. Доступ закрыт.", "error");
        onLogout();
        return;
    }

    renderDashboard(user);
    openModal(elements.dashboardModal);
    applyFestiveState();
}

function openModal(modal) {
    if (!modal) return;
    closeAllModals();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    
    // Скрываем шапку при открытии модального окна
    const header = document.querySelector('.header');
    if (header) {
        header.style.display = 'none';
    }
}

function closeAllModals() {
    [elements.loginModal, elements.dashboardModal, elements.userManageModal, elements.keyManageModal, elements.allKeysModal].forEach((modal) => {
        if (!modal) return;
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
    });
    document.body.classList.remove("modal-open");
    stopFestiveEffect();
    
    // Показываем шапку при закрытии всех модальных окон
    const header = document.querySelector('.header');
    if (header) {
        header.style.display = '';
    }
}

function showAuthView(view) {
    const isLogin = view === "login";
    elements.loginForm.hidden = !isLogin;
    elements.registerForm.hidden = isLogin;
    elements.loginForm.style.display = isLogin ? "grid" : "none";
    elements.registerForm.style.display = isLogin ? "none" : "grid";
    elements.showLoginTab.classList.toggle("tabs__btn--active", isLogin);
    elements.showRegisterTab.classList.toggle("tabs__btn--active", !isLogin);
}

async function handleDownload(filename, triggerButton = null) {
    const user = state.currentUser;

    // Loader is public: allow download without login.
    if (isPublicLoaderFile(filename)) {
        downloadPublicLoader(filename);
        return;
    }

    if (!user) {
        showToast("Сначала войдите в личный кабинет", "error");
        openLoginModal();
        return;
    }

    if (user.banned) {
        showToast("Ваш аккаунт заблокирован. Скачивание недоступно.", "error");
        return;
    }

    if (!canDownloadFile(user, filename)) {
        showToast("Файл недоступен для вашей роли.", "error");
        setKeyStatus("Файл недоступен для вашей роли.", "error");
        return;
    }

    if (!filename) {
        showToast("Файл не найден", "error");
        return;
    }

    if (state.downloadInProgress) {
        showToast("Скачивание уже выполняется, дождитесь завершения.", "error");
        return;
    }

    state.downloadInProgress = true;
    const initialButtonText = triggerButton?.textContent || "Скачать";
    if (triggerButton) {
        triggerButton.disabled = true;
        triggerButton.textContent = "Подготовка...";
    }
    setDownloadProgressState(true, 0, "Подготовка файла...");

    try {
        const token = getSessionToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const query = new URLSearchParams({ filename });

        const response = await fetch(`${API_BASE}/downloads/file?${query.toString()}`, {
            method: "GET",
            headers
        });

        if (!response.ok) {
            let payload = {};
            try {
                payload = await response.json();
            } catch {
                payload = {};
            }
            const error = new Error(payload.message || `HTTP ${response.status}`);
            error.status = response.status;
            error.payload = payload;
            throw error;
        }

        const totalBytes = Number(response.headers.get("content-length") || 0);
        const reader = response.body?.getReader?.();
        let blob;

        if (reader) {
            const chunks = [];
            let loadedBytes = 0;
            let lastPercent = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) {
                    chunks.push(value);
                    loadedBytes += value.byteLength;
                }

                if (totalBytes > 0) {
                    const percent = Math.min(100, Math.floor((loadedBytes / totalBytes) * 100));
                    if (percent !== lastPercent) {
                        setDownloadProgressState(
                            true,
                            percent,
                            `Скачивание: ${percent}% (${formatBytes(loadedBytes)} / ${formatBytes(totalBytes)})`
                        );
                        if (triggerButton) triggerButton.textContent = `${percent}%`;
                        lastPercent = percent;
                    }
                } else {
                    setDownloadProgressState(true, null, `Скачано: ${formatBytes(loadedBytes)}`);
                    if (triggerButton) triggerButton.textContent = "Скачивание...";
                }
            }

            blob = new Blob(chunks, { type: response.headers.get("content-type") || "application/octet-stream" });
        } else {
            blob = await response.blob();
        }

        setDownloadProgressState(true, 100, "Обработка файла...");
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);

        if (state.currentUser) {
            const headerValue = Number(response.headers.get("x-honoda-total-downloads"));
            const fallbackCount = Number(state.currentUser.stats?.totalDownloads || 0) + 1;
            const nextCount = Number.isFinite(headerValue) ? headerValue : fallbackCount;

            setCurrentUser({
                ...state.currentUser,
                stats: {
                    ...(state.currentUser.stats || {}),
                    totalDownloads: nextCount
                }
            });
        }

        if (state.currentUser) {
            if (state.currentUser) {
            renderDashboard(state.currentUser);
        }
        }

        setDownloadProgressState(true, 100, `Готово: ${filename}`);
        showToast(`Скачивание: ${filename}`, "success");
    } catch (error) {
        if (isUnauthorized(error)) {
            await handleLostSession();
            return;
        }
        showToast(getErrorMessage(error, "Ошибка скачивания"), "error");
        setDownloadProgressState(true, null, "Ошибка скачивания");
    } finally {
        state.downloadInProgress = false;
        if (triggerButton) {
            triggerButton.textContent = initialButtonText;
            triggerButton.disabled = false;
        }
        window.setTimeout(() => setDownloadProgressState(false, 0, ""), 1200);
    }
}

function renderDashboard(user) {
    elements.profileName.textContent = user.username;
    elements.profileMeta.textContent = `Участник с ${new Date(user.registeredAt).getFullYear()}`;
    elements.statDownloads.textContent = String(user.stats?.totalDownloads || 0);
    elements.statUid.textContent = String(user.uid ?? "-");
    
    // Показываем роль с информацией о времени истечения
    const roleText = getRoleDisplayText(user);
    elements.statRole.textContent = roleText;
    
    // Добавляем дополнительную информацию о временной роли
    if (user.roleRewardExpiresAt && user.roleBaseBeforeReward) {
        const timeRemaining = formatTimeRemaining(user.roleRewardExpiresAt);
        if (timeRemaining && timeRemaining !== "Истекла") {
            elements.profileMeta.textContent += ` | Роль до: ${new Date(user.roleRewardExpiresAt).toLocaleDateString('ru-RU')}`;
        } else if (timeRemaining === "Истекла") {
            elements.profileMeta.textContent += ` | Роль истекла, будет возвращена: ${user.roleBaseBeforeReward}`;
        }
    }
    
    // Обновляем UI активации ключей с учетом кулдауна
    updateKeyActivationUI(user);

    // Logged-in users should at least see the loader. Other files are admin-only.
    const canViewDownloads = true;

    const adminVisible = isAdmin(user);
    if (elements.userManageButton) elements.userManageButton.style.display = adminVisible ? "" : "none";
    if (elements.createKeyButton) elements.createKeyButton.style.display = adminVisible ? "" : "none";
    if (elements.viewAllKeysButton) elements.viewAllKeysButton.style.display = adminVisible ? "" : "none";
    if (elements.refreshRolesButton) elements.refreshRolesButton.style.display = adminVisible ? "" : "none";
    if (elements.maintenanceToggleButton) elements.maintenanceToggleButton.style.display = adminVisible ? "" : "none";
    if (elements.downloadGateToggleButton) {
        elements.downloadGateToggleButton.style.display = adminVisible ? "" : "none";
        elements.downloadGateToggleButton.textContent = state.freeDownloadEnabled
            ? "Запретить скачивание без ключа"
            : "Разрешить скачивание без ключа";
        elements.downloadGateToggleButton.classList.toggle("button--admin-on", state.freeDownloadEnabled);
    }
    renderMaintenanceControls();

    if (elements.downloadFilesSection) elements.downloadFilesSection.hidden = !canViewDownloads;
    if (elements.downloadFilesSection) {
        elements.downloadFilesSection.dataset.admin = isAdmin(user) ? "1" : "0";
    }

    if (elements.downloadAccessState) {
        elements.downloadAccessState.textContent = isAdmin(user)
            ? "✅ Статус доступа: роль Admin, все файлы доступны"
            : "🔓 Статус доступа: доступен только лоадер";
        elements.downloadAccessState.classList.toggle("download-access--ok", true);
        elements.downloadAccessState.classList.toggle("download-access--locked", false);
    }

    document.querySelectorAll("#downloadFilesSection .download-item").forEach((item) => {
        const button = item.querySelector(".download-button");
        if (!button) return;

        const filename = String(button.dataset.file || "").trim();
        const canShowItem = isAdmin(user) || isPublicLoaderFile(filename);
        // Visibility is primarily controlled via CSS (#downloadFilesSection[data-admin]).
        // We keep this check only to avoid enabling buttons for hidden items.
        if (!canShowItem) {
            button.disabled = true;
            button.classList.add("download-button--locked");
            return;
        }

        const allowed = canDownloadFile(user, filename);
        button.disabled = !allowed;
        button.classList.toggle("download-button--locked", !allowed);
        if (allowed) {
            button.title = "Скачать файл";
        } else {
            button.title = "Файл доступен только для роли Admin";
        }
    });

    if (elements.keyInput) elements.keyInput.value = "";
    if (user.key?.activated || hasDownloadAccess(user)) {
        setKeyStatus("✅ Ключ уже активирован! Пожизненный доступ к скачиванию открыт.", "success");
    } else if (isAdmin(user)) {
        setKeyStatus("✅ Роль Admin: доступны все файлы.", "success");
    } else {
        setKeyStatus("ℹ️ Без роли Admin доступно только скачивание лоадера.", "success");
    }
}

function setCurrentUser(user) {
    state.currentUser = user || null;
    setAuthButtonLabel();
    updateHomeDownloadsDisplay();
    renderMaintenanceControls();
}

function setAuthButtonLabel() {
    elements.authNavButton.textContent = state.currentUser ? state.currentUser.username : "Личный кабинет";
}

function updateHomeDownloadsDisplay() {
    if (!elements.homeDownloads) return;
    const count = state.currentUser?.stats?.totalDownloads || 0;
    elements.homeDownloads.textContent = String(count);
}

async function onUserManageOpen() {
    if (!isAdmin(state.currentUser)) {
        showToast("Доступно только администратору.", "error");
        return;
    }

    await fetchUsersAndRender();
    openModal(elements.userManageModal);
}

async function fetchUsersAndRender() {
    try {
        const data = await apiRequest("/users", { method: "GET", auth: true });
        state.users = Array.isArray(data.users) ? data.users : [];
        renderUserManageList();
    } catch (error) {
        if (isUnauthorized(error)) {
            await handleLostSession();
            return;
        }
        showToast(getErrorMessage(error, "Не удалось загрузить пользователей"), "error");
    }
}

function renderUserManageList() {
    if (!elements.userManageList) return;
    elements.userManageList.innerHTML = "";

    const users = [...state.users].sort((a, b) => (Number(a.uid) || 1e9) - (Number(b.uid) || 1e9));
    if (elements.userManageTotal) {
        elements.userManageTotal.textContent = `Участников: ${users.length}`;
    }
    for (const user of users) {
        const row = document.createElement("div");
        row.className = `user-row${user.banned ? " user-row--banned" : ""}`;

        const canBan = !isAdmin(user);
        const canRoleManage = Number(user.uid) !== 1;

        const actions = document.createElement("div");
        actions.className = "user-row__actions";

        const banBtn = document.createElement("button");
        banBtn.className = "user-row__ban";
        banBtn.type = "button";
        banBtn.textContent = "✕";
        banBtn.title = "Заблокировать";
        banBtn.disabled = !canBan || user.banned;

        const unbanBtn = document.createElement("button");
        unbanBtn.className = "user-row__unban";
        unbanBtn.type = "button";
        unbanBtn.textContent = "↺";
        unbanBtn.title = "Разблокировать";
        unbanBtn.disabled = !canBan || !user.banned;

        const roleSelect = document.createElement("select");
        roleSelect.className = "user-row__role";
        for (const role of AVAILABLE_ROLES) {
            const option = document.createElement("option");
            option.value = role;
            option.textContent = role;
            roleSelect.appendChild(option);
        }
        roleSelect.value = normalizeRole(user.role);
        roleSelect.disabled = !canRoleManage;

        const roleBtn = document.createElement("button");
        roleBtn.className = "user-row__role-save";
        roleBtn.type = "button";
        roleBtn.textContent = "Выдать";
        roleBtn.disabled = !canRoleManage;

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "user-row__delete";
        deleteBtn.type = "button";
        deleteBtn.textContent = "🗑️";
        deleteBtn.title = "Удалить пользователя";
        deleteBtn.disabled = !canRoleManage; // Только админы могут удалять

        if (canBan) {
            banBtn.addEventListener("click", () => banUser(user.username));
            unbanBtn.addEventListener("click", () => unbanUser(user.username));
        }

        if (canRoleManage) {
            roleBtn.addEventListener("click", () => setUserRole(user.username, roleSelect.value));
            deleteBtn.addEventListener("click", () => deleteUser(user.username));
        }

        const main = document.createElement("div");
        main.className = "user-row__main";

        const name = document.createElement("div");
        name.className = "user-row__name";
        
        if (user.isOnline) {
            const onlineIndicator = document.createElement("span");
            onlineIndicator.className = "user-online-indicator";
            onlineIndicator.title = "Активен на сайте";
            name.appendChild(onlineIndicator);
        }
        
        const userIp = formatRegistrationIp(user.registrationIp);
        const nameText = document.createTextNode(`${user.username} (IP: ${userIp})`);
        name.appendChild(nameText);

        const meta = document.createElement("div");
        meta.className = "user-row__meta";
        
        const bannedStatus = user.banned ? "Да" : "Нет";
        const onlineStatus = user.isOnline ? "Да" : "Нет";
        
        // Добавляем информацию о временной роли
        let roleInfo = normalizeRole(user.role);
        if (user.roleRewardExpiresAt && user.roleBaseBeforeReward) {
            const timeRemaining = formatTimeRemaining(user.roleRewardExpiresAt);
            if (timeRemaining && timeRemaining !== "Истекла") {
                roleInfo += ` (${timeRemaining}, вернется: ${user.roleBaseBeforeReward})`;
            } else if (timeRemaining === "Истекла") {
                roleInfo += ` (истекла, вернется: ${user.roleBaseBeforeReward})`;
            }
        }
        
        meta.textContent = `Год регистрации: ${getRegisteredYear(user.registeredAt)} | UID: ${user.uid ?? "-"} | Role: ${roleInfo} | Забанен: ${bannedStatus} | Активен на сайте: ${onlineStatus}`;


        actions.append(banBtn, unbanBtn, roleSelect, roleBtn, deleteBtn);
        main.append(name, meta);
        row.append(actions, main);
        elements.userManageList.appendChild(row);
    }
}

async function banUser(username) {
    try {
        const data = await apiRequest("/users/ban", {
            method: "POST",
            auth: true,
            body: { username }
        });
        showToast(data.message || "Пользователь заблокирован", "success");
        await fetchUsersAndRender();
    } catch (error) {
        if (isUnauthorized(error)) {
            await handleLostSession();
            return;
        }
        showToast(getErrorMessage(error, "Ошибка бана"), "error");
    }
}

async function unbanUser(username) {
    try {
        const data = await apiRequest("/users/unban", {
            method: "POST",
            auth: true,
            body: { username }
        });
        showToast(data.message || "Пользователь разблокирован", "success");
        await fetchUsersAndRender();
    } catch (error) {
        if (isUnauthorized(error)) {
            await handleLostSession();
            return;
        }
        showToast(getErrorMessage(error, "Ошибка разбана"), "error");
    }
}

async function setUserRole(username, role) {
    try {
        const data = await apiRequest("/users/role", {
            method: "POST",
            auth: true,
            body: { username, role }
        });

        showToast(data.message || "Роль обновлена", "success");
        await fetchUsersAndRender();

        if (state.currentUser?.username === username) {
            await restoreSession();
            if (state.currentUser && elements.dashboardModal.classList.contains("is-open")) {
                if (state.currentUser) {
            renderDashboard(state.currentUser);
        }
            }
        }
    } catch (error) {
        if (isUnauthorized(error)) {
            await handleLostSession();
            return;
        }
        showToast(getErrorMessage(error, "Ошибка роли"), "error");
    }
}

async function deleteUser(username) {
    // Подтверждение удаления
    if (!confirm(`Вы уверены, что хотите удалить пользователя "${username}"? Это действие нельзя отменить!`)) {
        return;
    }

    try {
        const data = await apiRequest("/users/delete", {
            method: "POST",
            auth: true,
            body: { username }
        });

        showToast(data.message || "Пользователь удален", "success");
        await fetchUsersAndRender();
    } catch (error) {
        if (isUnauthorized(error)) {
            await handleLostSession();
            return;
        }
        showToast(getErrorMessage(error, "Ошибка удаления"), "error");
    }
}

async function onRefreshRolesClick() {
    if (!isAdmin(state.currentUser)) {
        showToast("Доступно только администратору.", "error");
        return;
    }

    try {
        const data = await apiRequest("/admin/refresh-roles", {
            method: "POST",
            auth: true
        });

        showToast(data.message || "Роли обновлены", "success");
        
        // Обновляем список пользователей если открыт
        if (elements.userManageModal.classList.contains("is-open")) {
            await fetchUsersAndRender();
        }
        
        // Обновляем текущего пользователя
        await restoreSession();
        if (state.currentUser && elements.dashboardModal.classList.contains("is-open")) {
            renderDashboard(state.currentUser);
        }
    } catch (error) {
        if (isUnauthorized(error)) {
            await handleLostSession();
            return;
        }
        showToast(getErrorMessage(error, "Ошибка обновления ролей"), "error");
    }
}

function onCreateKeyOpen() {
    if (!isAdmin(state.currentUser)) {
        showToast("Доступно только администратору.", "error");
        return;
    }

    if (elements.createdKeyResult) {
        elements.createdKeyResult.textContent = "";
    }
    if (elements.activeKeysList) {
        elements.activeKeysList.innerHTML = "";
    }

    openModal(elements.keyManageModal);
}

async function onCreateKeySubmit(event) {
    event.preventDefault();

    if (!isAdmin(state.currentUser)) {
        showToast("Доступно только администратору.", "error");
        return;
    }

    const formData = new FormData(elements.keyCreateForm);
    const maxActivations = Number(formData.get("maxActivations") || 0);
    const rewardDownloadAccess = formData.get("rewardDownloadAccess") === "on";
    const rewardRole = String(formData.get("rewardRole") || "").trim();
    const rewardRoleDays = String(formData.get("rewardRoleDays") || "").trim();

    try {
        const data = await apiRequest("/keys/create", {
            method: "POST",
            auth: true,
            body: { maxActivations, rewardDownloadAccess, rewardRole, rewardRoleDays }
        });

        if (elements.createdKeyResult) {
            const rewards = [];
            if (data.rewardDownloadAccess) {
                rewards.push("доступ к скачиванию");
            }
            if (data.rewardRole) {
                rewards.push(formatRewardRoleLabel(data.rewardRole, data.rewardRoleDays));
            }
            const rewardText = rewards.length > 0 
                ? "Награды: " + rewards.join(", ")
                : "Награды: нет";
            elements.createdKeyResult.textContent = `Ключ: ${data.code} | Активации: ${data.usedCount}/${data.maxActivations} | ${rewardText}`;
        }

        showToast("Ключ создан успешно.", "success");
    } catch (error) {
        if (isUnauthorized(error)) {
            await handleLostSession();
            return;
        }
        showToast(getErrorMessage(error, "Ошибка создания ключа"), "error");
    }
}

async function onShowActiveKeys() {
    if (!isAdmin(state.currentUser)) {
        showToast("Доступно только администратору.", "error");
        return;
    }

    try {
        const data = await apiRequest("/keys/active", { method: "GET", auth: true });
        const keys = Array.isArray(data.keys) ? data.keys : [];
        renderActiveKeys(keys);
        if (!keys.length) {
            showToast("Активных ключей нет.", "success");
        }
    } catch (error) {
        if (isUnauthorized(error)) {
            await handleLostSession();
            return;
        }
        showToast(getErrorMessage(error, "Ошибка загрузки ключей"), "error");
    }
}

function renderActiveKeys(keys) {
    if (!elements.activeKeysList) return;
    elements.activeKeysList.innerHTML = "";

    if (!keys.length) {
        const empty = document.createElement("div");
        empty.className = "active-key-item";

        const text = document.createElement("div");
        text.className = "active-key-item__meta";
        text.textContent = "Активных ключей пока нет.";

        empty.appendChild(text);
        elements.activeKeysList.appendChild(empty);
        return;
    }

    for (const key of keys) {
        const item = document.createElement("div");
        item.className = "active-key-item";

        const code = document.createElement("div");
        code.className = "active-key-item__code";
        code.textContent = key.code;

        const meta = document.createElement("div");
        meta.className = "active-key-item__meta";
        const used = Number(key.usedCount || 0);
        const max = Number(key.maxActivations || 0);
        const left = Number(key.leftActivations || Math.max(0, max - used));
        
        const rewards = [];
        if (key.rewardDownloadAccess) rewards.push("доступ к скачиванию");
        if (key.rewardRole) rewards.push(formatRewardRoleLabel(key.rewardRole, key.rewardRoleDays));
        const rewardText = rewards.length > 0 ? "Награды: " + rewards.join(", ") : "Награды: нет";
        
        meta.textContent = `Активации: ${used}/${max} | Осталось: ${left} | ${rewardText}`;

        item.append(code, meta);
        elements.activeKeysList.appendChild(item);
    }
}

async function onActivateKey() {
    if (!state.currentUser) {
        showToast("Сначала войдите в личный кабинет", "error");
        openLoginModal();
        return;
    }

    // Проверяем кулдаун на клиенте
    if (state.currentUser.key?.cooldown?.active) {
        setKeyStatus(`⏰ Кулдаун активен. Следующая активация через: ${state.currentUser.key.cooldown.timeFormatted}`, "error");
        return;
    }

    const code = String(elements.keyInput?.value || "").trim();
    if (!code) {
        setKeyStatus("Введите ключ.", "error");
        return;
    }

    try {
        const data = await apiRequest("/keys/activate", {
            method: "POST",
            auth: true,
            body: { code }
        });

        if (data.user) {
            setCurrentUser(data.user);
            if (elements.dashboardModal.classList.contains("is-open")) {
                renderDashboard(data.user);
            }
        }

        if (data.reward?.downloadAccessGranted) {
            showToast("Пожизненный доступ к скачиванию открыт.", "success");
        }

        // Очищаем поле ввода после успешной активации
        if (elements.keyInput) {
            elements.keyInput.value = "";
        }

        setKeyStatus(data.message || "Ключ активирован", "success");
    } catch (error) {
        if (isUnauthorized(error)) {
            await handleLostSession();
            return;
        }
        
        // Обрабатываем ошибку кулдауна
        if (error.status === 429 && error.data?.cooldown) {
            setKeyStatus(`⏰ ${error.data.message}`, "error");
        } else {
            setKeyStatus(getErrorMessage(error, "Ошибка ключа"), "error");
        }
    }
}

async function refreshSiteStatus() {
    try {
        const data = await apiRequest("/site/status", { method: "GET", auth: true });
        state.maintenanceEnabled = !!data.maintenanceEnabled;
        state.freeDownloadEnabled = !!data.freeDownloadEnabled;
        setMaintenanceOverlay(state.maintenanceEnabled && !data.canAccess, data.message || MAINTENANCE_MESSAGE);
        renderMaintenanceControls();
        return data;
    } catch {
        setMaintenanceOverlay(false, "");
        return {
            maintenanceEnabled: false,
            freeDownloadEnabled: false,
            canAccess: true,
            isAdmin: isAdmin(state.currentUser),
            message: ""
        };
    }
}

function setMaintenanceOverlay(visible, message) {
    if (!elements.maintenanceBlocker) return;
    elements.maintenanceBlocker.hidden = !visible;
    if (elements.maintenanceBlockerMessage) {
        elements.maintenanceBlockerMessage.textContent = message || MAINTENANCE_MESSAGE;
    }
}

function renderMaintenanceControls() {
    if (!elements.maintenanceStatusText) return;
    const admin = isAdmin(state.currentUser);
    const enabled = !!state.maintenanceEnabled;

    elements.maintenanceStatusText.textContent = enabled
        ? "Режим техработ: включен (доступ только для админа)"
        : "Режим техработ: выключен";
    elements.maintenanceStatusText.classList.toggle("maintenance-status--on", enabled);
    elements.maintenanceStatusText.classList.toggle("maintenance-status--off", !enabled);

    if (!admin) {
        if (elements.maintenanceToggleButton) {
            elements.maintenanceToggleButton.style.display = "none";
        }
        return;
    }

    if (elements.maintenanceToggleButton) {
        elements.maintenanceToggleButton.style.display = "";
        elements.maintenanceToggleButton.textContent = enabled ? "Выключить техработы" : "Включить техработы";
    }
}

async function onMaintenanceToggleClick() {
    if (!isAdmin(state.currentUser)) {
        showToast("Только администратор может менять режим сайта.", "error");
        return;
    }

    const nextEnabled = !state.maintenanceEnabled;
    try {
        const data = await apiRequest("/site/maintenance", {
            method: "POST",
            auth: true,
            body: { enabled: nextEnabled }
        });
        state.maintenanceEnabled = !!data.maintenanceEnabled;
        renderMaintenanceControls();
        showToast(data.message || "Режим сайта обновлен.", "success");
        await refreshSiteStatus();
    } catch (error) {
        if (isUnauthorized(error)) {
            await handleLostSession();
            return;
        }
        showToast(getErrorMessage(error, "Не удалось изменить режим техработ"), "error");
    }
}

async function onDownloadGateToggleClick() {
    if (!isAdmin(state.currentUser)) {
        showToast("Только администратор может менять режим скачивания.", "error");
        return;
    }

    const nextEnabled = !state.freeDownloadEnabled;
    try {
        const data = await apiRequest("/site/free-download", {
            method: "POST",
            auth: true,
            body: { enabled: nextEnabled }
        });
        state.freeDownloadEnabled = !!data.freeDownloadEnabled;
        showToast(data.message || "Режим скачивания обновлён.", "success");
        if (state.currentUser) {
            renderDashboard(state.currentUser);
        }
    } catch (error) {
        if (isUnauthorized(error)) {
            await handleLostSession();
            return;
        }
        showToast(getErrorMessage(error, "Не удалось изменить режим скачивания"), "error");
    }
}

function onMaintenanceAdminLoginClick() {
    openLoginModal();
}

function setKeyStatus(text, type) {
    if (!elements.keyStatusText) return;
    elements.keyStatusText.textContent = text || "";
    elements.keyStatusText.classList.remove("key-status-text--success", "key-status-text--error");
    if (!text) return;
    elements.keyStatusText.classList.add(type === "success" ? "key-status-text--success" : "key-status-text--error");
}

function onFestiveToggleClick() {
    state.festiveEnabled = !state.festiveEnabled;
    saveFestiveEnabled(state.festiveEnabled);
    renderFestiveToggle();
    applyFestiveState();
    showToast(state.festiveEnabled ? "Праздничные частицы: включены" : "Праздничные частицы: выключены", "success");
}

function renderFestiveToggle() {
    if (!elements.festiveToggleButton) return;
    elements.festiveToggleButton.textContent = state.festiveEnabled ? "Частицы: вкл" : "Частицы: выкл";
    elements.festiveToggleButton.classList.toggle("festive-toggle--on", state.festiveEnabled);
}

function applyFestiveState() {
    const isDashboardOpen = elements.dashboardModal.classList.contains("is-open");
    if (state.festiveEnabled && isDashboardOpen) {
        startFestiveEffect();
    } else {
        stopFestiveEffect();
    }
}

function startFestiveEffect() {
    if (!elements.festiveLayer || festiveTimerId) return;
    festiveTimerId = window.setInterval(createFestiveParticle, 180);
}

function stopFestiveEffect() {
    if (festiveTimerId) {
        window.clearInterval(festiveTimerId);
        festiveTimerId = null;
    }
    if (elements.festiveLayer) {
        elements.festiveLayer.innerHTML = "";
    }
}

function createFestiveParticle() {
    if (!elements.festiveLayer) return;

    const particle = document.createElement("span");
    particle.className = "festive-particle";

    const size = randomInt(5, 11);
    const duration = randomInt(1600, 3200);

    particle.style.left = `${randomInt(2, 98)}%`;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.background = `hsl(${randomInt(0, 360)} 95% 65%)`;
    particle.style.animationDuration = `${duration}ms`;
    particle.style.setProperty("--fall-distance", `${Math.max(elements.festiveLayer.clientHeight + 40, 420)}px`);

    elements.festiveLayer.appendChild(particle);
    window.setTimeout(() => particle.remove(), duration + 200);
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function initFeatureAnimations() {
    const cards = Array.from(document.querySelectorAll("#features .card"));
    if (!cards.length) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        cards.forEach((card) => card.classList.add("is-visible"));
        return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const card = entry.target;
            const index = Number(card.dataset.cardIndex || 0);
            window.setTimeout(() => card.classList.add("is-visible"), index * 90);
            obs.unobserve(card);
        });
    }, {
        threshold: 0.18,
        rootMargin: "0px 0px -8% 0px"
    });

    cards.forEach((card, index) => {
        card.dataset.cardIndex = String(index);
        observer.observe(card);
    });
}

function setDownloadProgressState(visible, percent, text) {
    if (!elements.downloadProgress || !elements.downloadProgressBar || !elements.downloadProgressText) return;
    elements.downloadProgress.hidden = !visible;
    if (visible) {
        const safePercent = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
        elements.downloadProgressBar.style.width = `${safePercent}%`;
        elements.downloadProgressText.textContent = text || "";
    } else {
        elements.downloadProgressBar.style.width = "0%";
        elements.downloadProgressText.textContent = "";
    }
}

function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return "0 B";
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
    return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function canAccessAdminOnlyDownload(user) {
    return isAdmin(user);
}

function canUseGeneralDownload(user) {
    return !!(hasDownloadAccess(user) || state.freeDownloadEnabled);
}

function isAdminOnlyDownloadFile(filename) {
    const normalized = String(filename || "").trim().toLowerCase();
    return ADMIN_ONLY_FILES.has(normalized);
}

function canDownloadFile(user, filename) {
    const normalized = String(filename || "").trim();
    if (!normalized) return false;
    if (isPublicLoaderFile(normalized)) return true;
    if (isAdminOnlyDownloadFile(normalized)) {
        return canAccessAdminOnlyDownload(user);
    }
    return canUseGeneralDownload(user);
}

function isPublicLoaderFile(filename) {
    const normalized = String(filename || "").trim().toLowerCase();
    return PUBLIC_LOADER_FILES.has(normalized);
}

function downloadPublicLoader(filename) {
    const safe = String(filename || PUBLIC_LOADER_DEFAULT).trim() || PUBLIC_LOADER_DEFAULT;
    const query = new URLSearchParams({ filename: safe });
    window.location.href = `${API_BASE}/downloads/public?${query.toString()}`;
}

function isAdmin(user) {
    if (!user) return false;
    return normalizeRole(user.role) === "Admin" || Number(user.uid) === 1;
}

function isRootAdmin(user) {
    if (!user) return false;
    return Number(user.uid) === 1;
}

function hasDownloadAccess(user) {
    return !!(user?.access?.canDownload || user?.hasDownloadAccess);
}

function normalizeRole(role) {
    const value = String(role || "").trim();
    if (AVAILABLE_ROLES.includes(value)) return value;
    if (value === "Member") return "User";
    if (value === "Beta") return "Alpha"; // Auto-migrate Beta to Alpha
    return "User";
}

function formatTimeRemaining(expiresAt) {
    if (!expiresAt) return null;
    
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires - now;
    
    if (diff <= 0) return "Истекла";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
        return `${days} дн. ${hours} ч.`;
    } else if (hours > 0) {
        return `${hours} ч. ${minutes} мин.`;
    } else {
        return `${minutes} мин.`;
    }
}

function getRoleDisplayText(user) {
    const role = normalizeRole(user.role);
    const expiresAt = user.roleRewardExpiresAt;
    const baseRole = user.roleBaseBeforeReward;
    
    if (!expiresAt || !baseRole) {
        return role; // Постоянная роль
    }
    
    const timeRemaining = formatTimeRemaining(expiresAt);
    if (timeRemaining === "Истекла") {
        return `${role} (истекла)`;
    }
    
    return `${role} (${timeRemaining})`;
}

function formatCooldownTime(minutes) {
    if (minutes <= 0) return "0 мин.";
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
        return `${hours} ч. ${mins} мин.`;
    } else {
        return `${mins} мин.`;
    }
}

function updateKeyActivationUI(user) {
    const keyInput = elements.keyInput;
    const activateButton = elements.activateKeyButton;
    const statusText = elements.keyStatusText;
    
    if (!keyInput || !activateButton || !statusText) return;
    
    if (user.key?.cooldown?.active) {
        activateButton.disabled = true;
        activateButton.textContent = "Кулдаун активен";
        statusText.textContent = `⏰ Следующая активация через: ${user.key.cooldown.timeFormatted}`;
        statusText.className = "key-status-text key-status-text--cooldown";
    } else {
        activateButton.disabled = false;
        activateButton.textContent = "Активировать ключ";
        statusText.textContent = "";
        statusText.className = "key-status-text";
    }
}

function formatRewardRoleLabel(role, days) {
    const normalizedRole = normalizeRole(role);
    const rawDays = Number(days || 0);
    if (rawDays > 0) {
        return `роль ${normalizedRole} на ${rawDays} дн.`;
    }
    return `роль ${normalizedRole} навсегда`;
}

function getRegisteredYear(value) {
    const parsed = Date.parse(value || "");
    if (!Number.isFinite(parsed)) return "-";
    return String(new Date(parsed).getFullYear());
}

function formatRegistrationIp(value) {
    const ip = String(value || "").trim();
    return ip || "unknown";
}

function showToast(text, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type === "error" ? "toast--error" : "toast--success"}`;
    toast.textContent = text;
    elements.toastContainer.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2800);
}

function getSessionToken() {
    return localStorage.getItem(STORAGE_KEYS.sessionToken) || readSessionTokenCookie();
}

function setSessionToken(token) {
    localStorage.setItem(STORAGE_KEYS.sessionToken, token);
    document.cookie = `honodadlc_session_token=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; SameSite=Lax`;
}

function clearSessionToken() {
    localStorage.removeItem(STORAGE_KEYS.sessionToken);
    document.cookie = "honodadlc_session_token=; Path=/; Max-Age=0; SameSite=Lax";
}

function readSessionTokenCookie() {
    const chunks = document.cookie ? document.cookie.split(";") : [];
    for (const chunk of chunks) {
        const [rawName, ...rawValue] = chunk.trim().split("=");
        if (rawName !== "honodadlc_session_token") continue;
        return decodeURIComponent(rawValue.join("=") || "");
    }
    return "";
}

function loadFestiveEnabled() {
    const value = localStorage.getItem(STORAGE_KEYS.festiveParticles);
    if (value === null) return false;
    return value === "1";
}

function saveFestiveEnabled(enabled) {
    localStorage.setItem(STORAGE_KEYS.festiveParticles, enabled ? "1" : "0");
}

async function apiRequest(path, options = {}) {
    const method = options.method || "GET";
    const auth = options.auth !== false;
    const headers = {
        "content-type": "application/json"
    };

    if (auth) {
        const token = getSessionToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
    }

    const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    let payload = {};
    try {
        payload = await response.json();
    } catch {
        payload = {};
    }

    if (!response.ok || payload.ok === false) {
        const error = new Error(payload.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload;
}

function getErrorMessage(error, fallback) {
    return error?.payload?.message || error?.message || fallback;
}

function isUnauthorized(error) {
    return Number(error?.status) === 401;
}

async function handleLostSession() {
    clearSessionToken();
    setCurrentUser(null);
    closeAllModals();
    await refreshSiteStatus();
    showToast("Сессия истекла, войдите снова", "error");
    openLoginModal();
}

async function onViewAllKeysOpen() {
    if (!isAdmin(state.currentUser)) {
        showToast("Доступно только администратору.", "error");
        return;
    }

    try {
        const data = await apiRequest("/keys/all", { method: "GET", auth: true });
        const keys = Array.isArray(data.keys) ? data.keys : [];
        renderAllKeys(keys);
        openModal(elements.allKeysModal);
    } catch (error) {
        if (isUnauthorized(error)) {
            await handleLostSession();
            return;
        }
        showToast(getErrorMessage(error, "Ошибка загрузки ключей"), "error");
    }
}

function renderAllKeys(keys) {
    if (!elements.allKeysList) return;
    elements.allKeysList.innerHTML = "";

    if (elements.allKeysTotal) {
        elements.allKeysTotal.textContent = `Ключей: ${keys.length}`;
    }

    if (!keys.length) {
        const empty = document.createElement("div");
        empty.className = "key-row";
        empty.textContent = "Ключей пока нет.";
        elements.allKeysList.appendChild(empty);
        return;
    }

    for (const key of keys) {
        const row = document.createElement("div");
        row.className = `key-row${key.isActive ? "" : " key-row--inactive"}`;

        const main = document.createElement("div");
        main.className = "key-row__main";

        const code = document.createElement("div");
        code.className = "key-row__code";
        code.textContent = key.code;

        const meta = document.createElement("div");
        meta.className = "key-row__meta";
        const used = Number(key.usedCount || 0);
        const max = Number(key.maxActivations || 0);
        const left = Number(key.leftActivations || Math.max(0, max - used));
        const status = key.isActive ? "Активен" : "Использован";
        
        const rewards = [];
        if (key.rewardDownloadAccess) rewards.push("доступ к скачиванию");
        if (key.rewardRole) rewards.push(formatRewardRoleLabel(key.rewardRole, key.rewardRoleDays));
        const rewardText = rewards.length > 0 ? "Награды: " + rewards.join(", ") : "Награды: нет";
        
        const createdDate = new Date(key.createdAt).toLocaleDateString("ru-RU");
        meta.textContent = `Статус: ${status} | Активации: ${used}/${max} | Осталось: ${left} | ${rewardText} | Создан: ${createdDate}`;

        main.append(code, meta);
        row.appendChild(main);
        elements.allKeysList.appendChild(row);
    }
}

async function loadGlobalStats() {
    try {
        const data = await apiRequest("/stats/global", { method: "GET", auth: false });
        if (elements.globalDownloads) {
            elements.globalDownloads.textContent = String(data.totalDownloads || 0);
        }
    } catch {
        if (elements.globalDownloads) {
            elements.globalDownloads.textContent = "0";
        }
    }
}

function updateDaysSinceLaunch() {
    if (!elements.daysSinceLaunch) return;
    const now = new Date();
    const diffMs = now - LAUNCH_DATE;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    elements.daysSinceLaunch.textContent = String(Math.max(0, diffDays));
}

function onThemeToggleClick() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    saveTheme(state.theme);
    applyTheme();
    showToast(state.theme === "dark" ? "Тёмная тема включена" : "Светлая тема включена", "success");
}

function applyTheme() {
    const isDark = state.theme === "dark";
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    if (elements.themeToggleButton) {
        elements.themeToggleButton.title = isDark ? "Светлая тема" : "Тёмная тема";
    }
}

function loadTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved === "dark" || saved === "light") return saved;
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
}

function saveTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.theme, theme);
}

async function onDeleteAllKeysClick() {
    if (!isAdmin(state.currentUser)) {
        showToast("Доступно только администратору.", "error");
        return;
    }

    const confirmed = confirm("⚠️ ВНИМАНИЕ!\n\nВы уверены, что хотите удалить ВСЕ ключи?\n\nЭто действие:\n• Удалит все ключи из базы данных\n• Удалит все записи об активациях\n• НЕВОЗМОЖНО отменить\n\nПродолжить?");
    
    if (!confirmed) {
        return;
    }

    const doubleConfirm = confirm("🔴 ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ!\n\nВы действительно хотите удалить ВСЕ ключи?\n\nВведите ДА в следующем окне для подтверждения.");
    
    if (!doubleConfirm) {
        return;
    }

    const finalConfirm = prompt("Введите 'УДАЛИТЬ ВСЕ' (заглавными буквами) для подтверждения:");
    
    if (finalConfirm !== "УДАЛИТЬ ВСЕ") {
        showToast("Удаление отменено.", "success");
        return;
    }

    try {
        const data = await apiRequest("/keys/delete-all", {
            method: "POST",
            auth: true
        });

        showToast(data.message || "Все ключи успешно удалены.", "success");
        
        if (elements.allKeysList) {
            elements.allKeysList.innerHTML = "";
        }
        if (elements.allKeysTotal) {
            elements.allKeysTotal.textContent = "Ключей: 0";
        }

        await onViewAllKeysOpen();
    } catch (error) {
        if (isUnauthorized(error)) {
            await handleLostSession();
            return;
        }
        showToast(getErrorMessage(error, "Ошибка удаления ключей"), "error");
    }
}
