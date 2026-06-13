/**
 * Firebase Integration & Cloud Database Sync V3.0 (Realtime Database Version)
 * Author: Antigravity Code Assistant
 * Functions: Firebase authentication observer, Realtime Database sync.
 */

// Your web app's Firebase configuration with Singapore Realtime Database URL
const firebaseConfig = {
  apiKey: "AIzaSyAojeQRZeuo3TsWP8jwtIRQeEuiKi3rSKg",
  authDomain: "shipmanagev33333.firebaseapp.com",
  projectId: "shipmanagev33333",
  storageBucket: "shipmanagev33333.firebasestorage.app",
  messagingSenderId: "208092300439",
  appId: "1:208092300439:web:e530edbb94c6fcc09fd5d2",
  measurementId: "G-SL25NGVYQC",
  databaseURL: "https://shipmanagev33333-default-rtdb.asia-southeast1.firebasedatabase.app"
};

let db = null;
let docRef = null;
let isFirebaseInitialized = false;

// Initialize Firebase App
function initFirebase() {
    try {
        if (typeof firebase !== 'undefined') {
            firebase.initializeApp(firebaseConfig);
            db = firebase.database();
            isFirebaseInitialized = true;
            console.log("Firebase Realtime Database initialized successfully!");
            
            // Listen for authentication changes
            setupAuthObserver();
        } else {
            console.warn("Firebase SDK is not loaded. Working in local-only mode.");
            showAppContainer();
            updateServerStatus('offline', 'Ngoại tuyến (Lưu cục bộ)');
        }
    } catch (e) {
        console.error("Failed to initialize Firebase:", e);
        showAppContainer();
        updateServerStatus('error', 'Lỗi kết nối Firebase');
    }
}

// Setup Firebase Authentication Observer
function setupAuthObserver() {
    firebase.auth().onAuthStateChanged((user) => {
        const loginScreen = document.getElementById('login-screen');
        const appContainer = document.querySelector('.app-container');
        
        if (user) {
            console.log("User is logged in:", user.email);
            // Hide login screen, show application
            if (loginScreen) loginScreen.style.display = 'none';
            if (appContainer) appContainer.style.display = 'flex';
            
            // Customize user profile in sidebar if available
            updateUserProfileUI(user.email);
            
            // Start listening to database changes
            setupFirebaseSync();
        } else {
            console.log("User is logged out.");
            // Show login screen, hide application
            if (loginScreen) loginScreen.style.display = 'flex';
            if (appContainer) appContainer.style.display = 'none';
            
            updateServerStatus('offline', 'Chưa đăng nhập');
        }
    });
}

// Helper to show app if Firebase fails or is offline
function showAppContainer() {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.querySelector('.app-container');
    if (loginScreen) loginScreen.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';
}

// Update sidebar user display with email
function updateUserProfileUI(email) {
    const userNameEl = document.querySelector('.user-profile .user-name');
    const userRoleEl = document.querySelector('.user-profile .user-role');
    if (userNameEl) {
        userNameEl.innerText = email.split('@')[0];
        userNameEl.title = email;
    }
    if (userRoleEl) {
        userRoleEl.innerHTML = `Admin <a href="#" onclick="event.preventDefault(); handleLogout();" style="color: var(--accent); margin-left: 8px; font-size: 0.75rem;"><i class="fa-solid fa-right-from-bracket"></i> Thoát</a>`;
    }
}

// Sign-in handler
window.handleLoginSubmit = function() {
    const emailEl = document.getElementById('login-email');
    const passwordEl = document.getElementById('login-password');
    const errorEl = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit-btn');
    
    if (!emailEl || !passwordEl) return;
    
    const email = emailEl.value.trim();
    const password = passwordEl.value;
    
    if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.innerText = '';
    }
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang xác thực...`;
    }
    
    firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log("Login successful!");
        })
        .catch((error) => {
            console.error("Login failed:", error);
            if (errorEl) {
                errorEl.style.display = 'block';
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    errorEl.innerText = 'Sai email đăng nhập hoặc mật khẩu!';
                } else if (error.code === 'auth/invalid-email') {
                    errorEl.innerText = 'Định dạng Email không hợp lệ!';
                } else {
                    errorEl.innerText = 'Đăng nhập thất bại: ' + error.message;
                }
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Đăng nhập hệ thống`;
            }
        });
};

// Sign-out handler
window.handleLogout = function() {
    if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?")) {
        firebase.auth().signOut()
            .then(() => {
                // Clear localStorage cached database to protect data when logging out
                localStorage.removeItem(DB_KEY);
                console.log("Logged out successfully, cache cleared.");
                window.location.reload();
            })
            .catch((error) => {
                console.error("Sign out error:", error);
                alert("Đăng xuất thất bại: " + error.message);
            });
    }
};

// Update Premium Server Status dot
function updateServerStatus(status, text) {
    const container = document.querySelector('.server-status');
    if (!container) return;
    
    let dotColor = '#10b981'; // Green
    let pulseClass = '';
    
    if (status === 'connecting') {
        dotColor = '#f59e0b'; // Amber
        pulseClass = 'animation: pulse 1s infinite alternate;';
    } else if (status === 'error' || status === 'offline') {
        dotColor = '#ef4444'; // Red
    }
    
    container.innerHTML = `
        <span class="status-dot" style="
            background-color: ${dotColor}; 
            box-shadow: 0 0 10px ${dotColor}; 
            display: inline-block; 
            width: 8px; 
            height: 8px; 
            border-radius: 50%; 
            margin-right: 6px; 
            vertical-align: middle;
            ${pulseClass}
        "></span>
        <span style="font-size: 0.85rem; font-weight: 500;">${text}</span>
    `;
}

// Two-way synchronization with Firebase Realtime Database
function setupFirebaseSync() {
    if (!db) return;
    
    const originalSave = AppData.save;
    docRef = db.ref('shipmanage/state');
    updateServerStatus('connecting', 'Đang kết nối Cloud...');

    // 1. Listen for updates in Realtime Database
    docRef.on('value', (snapshot) => {
        let cloudState = snapshot.val();
        console.log("Received state update from Firebase Realtime Database.");
        
        if (cloudState) {
            // Check if document stores state as a string in 'data' field
            if (cloudState && typeof cloudState === 'object' && cloudState.data && typeof cloudState.data === 'string') {
                try {
                    cloudState = JSON.parse(cloudState.data);
                } catch (e) {
                    console.error('Failed to parse cloud state JSON:', e);
                }
            }
            
            // Update AppData local state and localStorage
            if (cloudState && typeof cloudState === 'object' && Object.keys(cloudState).length > 0) {
                AppData.state = cloudState;
                
                // Recalculate to ensure new calculation logic is applied, bypassing cloud write during sync load
                const currentSave = AppData.save;
                AppData.save = originalSave;
                try {
                    AppData.recalculateAllShipments();
                } catch(e) {
                    console.error("Recalculation error during Firebase sync load:", e);
                } finally {
                    AppData.save = currentSave;
                }
                
                localStorage.setItem(DB_KEY, JSON.stringify(AppData.state));
                
                // Refresh active view if initialized
                if (typeof app !== 'undefined' && app.currentView) {
                    app.navigate(app.currentView);
                }
                
                updateServerStatus('online', 'Đồng bộ Đám mây');
            } else {
                console.warn("Received empty or invalid state from Realtime Database.");
                updateServerStatus('error', 'Dữ liệu trống');
            }
        } else {
            // First time use: RTDB is empty, upload local state as initial backup
            console.log("Realtime Database has no existing data. Uploading local state as backup.");
            if (AppData.state) {
                pushStateToCloud(AppData.state);
            }
        }
    }, (error) => {
        console.error("Realtime Database sync subscription error:", error);
        updateServerStatus('error', 'Lỗi đồng bộ (Ngoại tuyến)');
    });

    // 2. Intercept AppData.save() to automatically push changes to Realtime Database
    AppData.save = function() {
        // Save locally first for speed
        originalSave.call(AppData);
        
        // Push to Firebase in background
        if (isFirebaseInitialized && docRef && firebase.auth().currentUser) {
            pushStateToCloud(AppData.state);
        }
    };
}

// Core function to push state to Realtime Database (stores stateData as a stringified payload inside 'data')
function pushStateToCloud(stateData) {
    if (!docRef) return;
    updateServerStatus('connecting', 'Đang lưu đám mây...');
    
    const payload = {
        data: JSON.stringify(stateData),
        updatedAt: new Date().toISOString()
    };
    
    docRef.set(payload)
        .then(() => {
            updateServerStatus('online', 'Đồng bộ Đám mây');
        })
        .catch((err) => {
            console.error("Failed to save to Firebase Realtime Database:", err);
            updateServerStatus('error', 'Lỗi lưu (Offline)');
        });
}

// Force local data up to Firebase Realtime Database directly using SDK
window.forceSyncToCloud = function() {
    if (!AppData.state) {
        alert("Lỗi: Không có dữ liệu cục bộ để đẩy!");
        return;
    }
    
    const user = firebase.auth().currentUser;
    if (!user) {
        alert("Lỗi: Bạn cần đăng nhập để đồng bộ dữ liệu!");
        return;
    }
    
    if (confirm("HÀNH ĐỘNG NÀY SẼ GHI ĐÈ TOÀN BỘ DỮ LIỆU ĐÁM MÂY BẰNG DỮ LIỆU ĐANG CÓ TRÊN MÁY TÍNH NÀY.\n\nBạn có chắc chắn muốn ép đẩy dữ liệu Local lên Cloud không?")) {
        updateServerStatus('connecting', 'Đang ép lưu...');
        
        const payload = {
            data: JSON.stringify(AppData.state),
            updatedAt: new Date().toISOString()
        };

        docRef.set(payload)
            .then(() => {
                alert("✅ ĐỒNG BỘ THÀNH CÔNG!\n\nĐã ghi đè dữ liệu cục bộ lên Đám mây. Các thiết bị khác (iPad, Điện thoại) sẽ tự động đồng bộ sau vài giây!");
                updateServerStatus('online', 'Đồng bộ Đám mây');
            })
            .catch((err) => {
                console.error("Force sync failed:", err);
                updateServerStatus('error', 'Lỗi ép đồng bộ');
                alert("❌ THẤT BẠI: Lỗi đồng bộ đám mây!\n\nChi tiết: " + err.message);
            });
    }
};

// Initialize connection when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add pulsing CSS keyframes for indicator
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes pulse {
            from { transform: scale(1); opacity: 0.6; }
            to { transform: scale(1.3); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    // Start Firebase setup
    initFirebase();
});
