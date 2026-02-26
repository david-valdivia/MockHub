class Server {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.type = data.type || 'github';
        this.repoUrl = data.repo_url;
        this.token = data.token;
        this.branch = data.branch || 'main';
        this.isActive = data.is_active !== undefined ? Boolean(data.is_active) : false;
        this.lastSync = data.last_sync || null;
        this.createdAt = data.created_at;
    }

    static fromDatabase(row) {
        return new Server(row);
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            repoUrl: this.repoUrl,
            token: this.token ? '••••••••' : null,
            branch: this.branch,
            isActive: this.isActive,
            lastSync: this.lastSync,
            createdAt: this.createdAt
        };
    }

    static validate(data) {
        const errors = [];
        if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
            errors.push('Name is required');
        }
        if (!data.repo_url || typeof data.repo_url !== 'string' || data.repo_url.trim() === '') {
            errors.push('Repository URL is required');
        }
        if (!data.token || typeof data.token !== 'string' || data.token.trim() === '') {
            errors.push('Token is required');
        }
        return errors;
    }

    static parseRepoUrl(repoUrl) {
        // Support both https://github.com/owner/repo and owner/repo formats
        const match = repoUrl.match(/(?:github\.com\/)?([^/]+)\/([^/.]+)/);
        if (!match) return null;
        return { owner: match[1], repo: match[2] };
    }
}

module.exports = Server;
