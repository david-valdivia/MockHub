class BrowserNotificationService {
    constructor() {
        this.enabled = false;
        this.permission = 'default';
        this.settings = {
            showForActiveEndpoint: true,
            showForAllEndpoints: false,
            playSound: true,
            showRequestDetails: true
        };
        
        this.init();
    }

    async init() {
        if (!('Notification' in window)) {
            console.warn('Browser notifications are not supported');
            return false;
        }

        this.permission = Notification.permission;
        this.loadSettings();
        
        return true;
    }

    async requestPermission() {
        if (!('Notification' in window)) {
            throw new Error('Browser notifications are not supported');
        }

        if (Notification.permission === 'granted') {
            this.enabled = true;
            this.permission = 'granted';
            return true;
        }

        if (Notification.permission === 'denied') {
            throw new Error('Notification permission denied');
        }

        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            this.enabled = permission === 'granted';
            
            if (this.enabled) {
                this.saveSettings();
                this.showTestNotification();
            }
            
            return this.enabled;
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            throw error;
        }
    }

    showTestNotification() {
        if (!this.canShowNotification()) return;

        const notification = new Notification('MockHub', {
            body: 'Browser notifications are now enabled!',
            icon: '/favicon.ico',
            tag: 'mockhub-test'
        });

        setTimeout(() => {
            if (notification) {
                notification.close();
            }
        }, 3000);
    }

    showRequestNotification(endpointPath, requestData, isActiveEndpoint = false) {
        if (!this.canShowNotification()) return;

        // Check if we should show notification based on settings
        if (this.settings.showForActiveEndpoint && !isActiveEndpoint) {
            return;
        }

        if (!this.settings.showForAllEndpoints && !isActiveEndpoint) {
            return;
        }

        const title = `New ${requestData.method} Request`;
        let body = `Endpoint: /${endpointPath}`;
        
        if (this.settings.showRequestDetails && requestData.body) {
            try {
                const bodyPreview = typeof requestData.body === 'string' 
                    ? requestData.body 
                    : JSON.stringify(requestData.body);
                
                if (bodyPreview.length > 50) {
                    body += `\nBody: ${bodyPreview.substring(0, 50)}...`;
                } else {
                    body += `\nBody: ${bodyPreview}`;
                }
            } catch (e) {
                // Skip body preview if there's an error
            }
        }

        const notification = new Notification(title, {
            body: body,
            icon: '/favicon.ico',
            tag: `webhook-request-${endpointPath}`,
            requireInteraction: false,
            silent: !this.settings.playSound
        });

        // Auto-close notification after 5 seconds
        setTimeout(() => {
            if (notification) {
                notification.close();
            }
        }, 5000);

        // Handle notification click
        notification.onclick = () => {
            window.focus();
            notification.close();
            
            // Trigger custom event to switch to the endpoint
            window.dispatchEvent(new CustomEvent('focusEndpoint', {
                detail: { path: endpointPath }
            }));
        };

        return notification;
    }

    showEndpointCreatedNotification(endpointPath) {
        if (!this.canShowNotification()) return;

        const notification = new Notification('New Endpoint Created', {
            body: `Endpoint /${endpointPath} is now available`,
            icon: '/favicon.ico',
            tag: `webhook-endpoint-created-${endpointPath}`,
            requireInteraction: false,
            silent: !this.settings.playSound
        });

        setTimeout(() => {
            if (notification) {
                notification.close();
            }
        }, 4000);

        return notification;
    }

    canShowNotification() {
        return this.enabled && 
               this.permission === 'granted' && 
               'Notification' in window &&
               document.visibilityState === 'hidden'; // Only show when tab is not active
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
    }

    getSettings() {
        return { ...this.settings };
    }

    isEnabled() {
        return this.enabled && this.permission === 'granted';
    }

    getPermissionStatus() {
        return this.permission;
    }

    disable() {
        this.enabled = false;
        this.saveSettings();
    }

    enable() {
        if (this.permission === 'granted') {
            this.enabled = true;
            this.saveSettings();
        } else {
            throw new Error('Permission not granted');
        }
    }

    saveSettings() {
        try {
            const settingsToSave = {
                enabled: this.enabled,
                ...this.settings
            };
            localStorage.setItem('mockhub-notifications', JSON.stringify(settingsToSave));
        } catch (error) {
            console.warn('Failed to save notification settings:', error);
        }
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('mockhub-notifications');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.enabled = parsed.enabled && this.permission === 'granted';
                this.settings = {
                    showForActiveEndpoint: parsed.showForActiveEndpoint ?? true,
                    showForAllEndpoints: parsed.showForAllEndpoints ?? false,
                    playSound: parsed.playSound ?? true,
                    showRequestDetails: parsed.showRequestDetails ?? true
                };
            }
        } catch (error) {
            console.warn('Failed to load notification settings:', error);
        }
    }
}

// Export for ES6 modules and window global
export { BrowserNotificationService }
if (typeof window !== 'undefined') {
  window.BrowserNotificationService = BrowserNotificationService
}