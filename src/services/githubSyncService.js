const environmentRepo = require('../repositories/environmentRepository');
const groupRepo = require('../repositories/groupRepository');
const routeRepo = require('../repositories/routeRepository');
const ruleRepo = require('../repositories/ruleRepository');
const serverRepo = require('../repositories/serverRepository');
const Environment = require('../models/environment');
const Server = require('../models/server');

const GITHUB_API = 'https://api.github.com';

class GitHubSyncService {
    slugify(name) {
        return name
            .toLowerCase()
            .replace(/^\/+/, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            || 'untitled';
    }

    _parseRepo(repoUrl) {
        const parsed = Server.parseRepoUrl(repoUrl);
        if (!parsed) throw new Error('Invalid repository URL');
        return parsed;
    }

    async _githubRequest(method, url, token, body = null) {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'MockHub'
        };
        if (body) headers['Content-Type'] = 'application/json';

        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(url, options);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`GitHub API ${response.status}: ${errorBody}`);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    async testConnection(serverData) {
        const { owner, repo } = this._parseRepo(serverData.repo_url);
        const token = serverData.token;

        // Test repo access
        const repoInfo = await this._githubRequest(
            'GET',
            `${GITHUB_API}/repos/${owner}/${repo}`,
            token
        );

        // Check permissions
        const permissions = repoInfo.permissions || {};
        const canPush = permissions.push || permissions.admin;

        return {
            success: true,
            repoName: repoInfo.full_name,
            private: repoInfo.private,
            defaultBranch: repoInfo.default_branch,
            canPush: !!canPush,
            permissions
        };
    }

    async listRemoteEnvironments(serverRow) {
        const { owner, repo } = this._parseRepo(serverRow.repo_url);
        const branch = serverRow.branch || 'main';

        let contents;
        try {
            contents = await this._githubRequest(
                'GET',
                `${GITHUB_API}/repos/${owner}/${repo}/contents/?ref=${branch}`,
                serverRow.token
            );
        } catch (err) {
            if (err.message.includes('404')) {
                return []; // Empty repo
            }
            throw err;
        }

        const environments = [];
        const dirs = contents.filter(item => item.type === 'dir');

        for (const dir of dirs) {
            try {
                const envJsonUrl = `${GITHUB_API}/repos/${owner}/${repo}/contents/${dir.name}/_environment.json?ref=${branch}`;
                const envFile = await this._githubRequest('GET', envJsonUrl, serverRow.token);
                const envData = JSON.parse(Buffer.from(envFile.content, 'base64').toString('utf-8'));
                environments.push({
                    slug: dir.name,
                    name: envData.name || dir.name,
                    basePath: envData.base_path || `/${dir.name}`,
                    description: envData.description || ''
                });
            } catch {
                // Skip directories without _environment.json
            }
        }

        return environments;
    }

    async pullEnvironment(serverRow, envSlug) {
        const { owner, repo } = this._parseRepo(serverRow.repo_url);
        const branch = serverRow.branch || 'main';

        // Read _environment.json
        const envFile = await this._githubRequest(
            'GET',
            `${GITHUB_API}/repos/${owner}/${repo}/contents/${envSlug}/_environment.json?ref=${branch}`,
            serverRow.token
        );
        const envData = JSON.parse(Buffer.from(envFile.content, 'base64').toString('utf-8'));

        // List groups (subdirectories)
        const envContents = await this._githubRequest(
            'GET',
            `${GITHUB_API}/repos/${owner}/${repo}/contents/${envSlug}?ref=${branch}`,
            serverRow.token
        );

        const groupDirs = envContents.filter(item => item.type === 'dir');
        const groups = [];

        for (const groupDir of groupDirs) {
            // Read _group.json
            let groupData = { name: groupDir.name, sort_order: 0 };
            try {
                const groupFile = await this._githubRequest(
                    'GET',
                    `${GITHUB_API}/repos/${owner}/${repo}/contents/${envSlug}/${groupDir.name}/_group.json?ref=${branch}`,
                    serverRow.token
                );
                groupData = JSON.parse(Buffer.from(groupFile.content, 'base64').toString('utf-8'));
            } catch {
                // Use defaults if no _group.json
            }

            // List route files
            const groupContents = await this._githubRequest(
                'GET',
                `${GITHUB_API}/repos/${owner}/${repo}/contents/${envSlug}/${groupDir.name}?ref=${branch}`,
                serverRow.token
            );

            const routeFiles = groupContents.filter(
                item => item.type === 'file' && item.name.endsWith('.json') && item.name !== '_group.json'
            );

            const routes = [];
            for (const routeFile of routeFiles) {
                const routeContent = await this._githubRequest('GET', routeFile.url, serverRow.token);
                const routeData = JSON.parse(Buffer.from(routeContent.content, 'base64').toString('utf-8'));
                routes.push(routeData);
            }

            groups.push({
                name: groupData.name || groupDir.name,
                sort_order: groupData.sort_order || 0,
                routes
            });
        }

        // Build import format compatible with existing import logic
        const importData = {
            mockhub_version: '1.0',
            exported_at: new Date().toISOString(),
            environment: {
                name: envData.name,
                base_path: envData.base_path,
                description: envData.description || '',
                groups
            }
        };

        return importData;
    }

    async importPulledEnvironment(importData) {
        const envData = importData.environment;
        let basePath = Environment.sanitizeBasePath(envData.base_path);

        let counter = 1;
        while (await environmentRepo.exists(basePath)) {
            basePath = Environment.sanitizeBasePath(envData.base_path) + '-' + counter;
            counter++;
        }

        const env = await environmentRepo.create({
            name: envData.name,
            base_path: basePath,
            description: envData.description || '',
            slug: this.slugify(envData.name)
        });

        for (const groupData of (envData.groups || [])) {
            const group = await groupRepo.create({
                environment_id: env.id,
                name: groupData.name,
                sort_order: groupData.sort_order || 0,
                slug: this.slugify(groupData.name)
            });

            for (const routeData of (groupData.routes || [])) {
                const route = await routeRepo.create({
                    group_id: group.id,
                    method: routeData.method || 'ALL',
                    path_pattern: routeData.path_pattern,
                    capture_requests: routeData.capture_requests !== undefined ? routeData.capture_requests : true,
                    slug: this.slugify(routeData.path_pattern || 'route')
                });

                for (const ruleData of (routeData.rules || [])) {
                    await ruleRepo.create({
                        route_id: route.id,
                        name: ruleData.name || '',
                        priority: ruleData.priority || 0,
                        conditions: ruleData.conditions || [],
                        status_code: ruleData.response?.status_code || 200,
                        content_type: ruleData.response?.content_type || 'application/json',
                        body: ruleData.response?.body || '{"message":"OK"}',
                        delay: ruleData.response?.delay || 0,
                        webhook_url: ruleData.webhook?.url || null,
                        webhook_method: ruleData.webhook?.method || 'POST',
                        webhook_headers: ruleData.webhook?.headers || {},
                        webhook_body: ruleData.webhook?.body || null,
                        webhook_delay: ruleData.webhook?.delay || 0,
                        webhook_content_type: ruleData.webhook?.content_type || 'application/json',
                        webhook_enabled: ruleData.webhook?.enabled !== undefined ? ruleData.webhook.enabled : true
                    });
                }
            }
        }

        return env;
    }

    async pushEnvironment(serverRow, envId) {
        const { owner, repo } = this._parseRepo(serverRow.repo_url);
        const branch = serverRow.branch || 'main';

        // Load full environment tree
        const env = await environmentRepo.findById(envId);
        if (!env) throw new Error('Environment not found');

        const envSlug = env.slug || this.slugify(env.name);
        const groups = await groupRepo.findByEnvironmentId(env.id);

        // Write _environment.json
        await this._putFile(owner, repo, branch, serverRow.token,
            `${envSlug}/_environment.json`,
            JSON.stringify({ name: env.name, base_path: env.basePath, description: env.description }, null, 2),
            `MockHub sync: ${env.name}`
        );

        for (const group of groups) {
            const groupSlug = group.slug || this.slugify(group.name);
            const routes = await routeRepo.findByGroupId(group.id);

            // Write _group.json
            await this._putFile(owner, repo, branch, serverRow.token,
                `${envSlug}/${groupSlug}/_group.json`,
                JSON.stringify({ name: group.name, sort_order: group.sortOrder }, null, 2),
                `MockHub sync: ${env.name}/${group.name}`
            );

            for (const route of routes) {
                await this._pushSingleRoute(owner, repo, branch, serverRow.token, envSlug, groupSlug, env.name, group.name, route);
            }
        }

        // Update last_sync
        await serverRepo.update(serverRow.id, { last_sync: new Date().toISOString() });

        return { success: true, envSlug };
    }

    async pushGroup(serverRow, groupId) {
        const { owner, repo } = this._parseRepo(serverRow.repo_url);
        const branch = serverRow.branch || 'main';

        const group = await groupRepo.findById(groupId);
        if (!group) throw new Error('Group not found');

        const env = await environmentRepo.findById(group.environmentId);
        if (!env) throw new Error('Environment not found');

        const envSlug = env.slug || this.slugify(env.name);
        const groupSlug = group.slug || this.slugify(group.name);
        const routes = await routeRepo.findByGroupId(group.id);

        // Ensure _environment.json exists
        await this._putFile(owner, repo, branch, serverRow.token,
            `${envSlug}/_environment.json`,
            JSON.stringify({ name: env.name, base_path: env.basePath, description: env.description }, null, 2),
            `MockHub sync: ${env.name}`
        );

        // Write _group.json
        await this._putFile(owner, repo, branch, serverRow.token,
            `${envSlug}/${groupSlug}/_group.json`,
            JSON.stringify({ name: group.name, sort_order: group.sortOrder }, null, 2),
            `MockHub sync: ${env.name}/${group.name}`
        );

        for (const route of routes) {
            await this._pushSingleRoute(owner, repo, branch, serverRow.token, envSlug, groupSlug, env.name, group.name, route);
        }

        await serverRepo.update(serverRow.id, { last_sync: new Date().toISOString() });
        return { success: true, envSlug, groupSlug };
    }

    async pushRoute(serverRow, routeId) {
        const { owner, repo } = this._parseRepo(serverRow.repo_url);
        const branch = serverRow.branch || 'main';

        const route = await routeRepo.findById(routeId);
        if (!route) throw new Error('Route not found');

        const group = await groupRepo.findById(route.groupId);
        if (!group) throw new Error('Group not found');

        const env = await environmentRepo.findById(group.environmentId);
        if (!env) throw new Error('Environment not found');

        const envSlug = env.slug || this.slugify(env.name);
        const groupSlug = group.slug || this.slugify(group.name);

        // Ensure _environment.json exists
        await this._putFile(owner, repo, branch, serverRow.token,
            `${envSlug}/_environment.json`,
            JSON.stringify({ name: env.name, base_path: env.basePath, description: env.description }, null, 2),
            `MockHub sync: ${env.name}`
        );

        // Ensure _group.json exists
        await this._putFile(owner, repo, branch, serverRow.token,
            `${envSlug}/${groupSlug}/_group.json`,
            JSON.stringify({ name: group.name, sort_order: group.sortOrder }, null, 2),
            `MockHub sync: ${env.name}/${group.name}`
        );

        await this._pushSingleRoute(owner, repo, branch, serverRow.token, envSlug, groupSlug, env.name, group.name, route);

        await serverRepo.update(serverRow.id, { last_sync: new Date().toISOString() });
        return { success: true, envSlug, groupSlug, routeSlug: route.slug || this.slugify(route.pathPattern) };
    }

    async _pushSingleRoute(owner, repo, branch, token, envSlug, groupSlug, envName, groupName, route) {
        const routeSlug = route.slug || this.slugify(route.pathPattern);
        const rules = await ruleRepo.findByRouteId(route.id);

        const routeData = {
            method: route.method,
            path_pattern: route.pathPattern,
            capture_requests: route.captureRequests,
            rules: rules.map(r => {
                const rule = {
                    name: r.name || '',
                    priority: r.priority,
                    conditions: r.conditions,
                    response: {
                        status_code: r.statusCode,
                        content_type: r.contentType,
                        body: r.body,
                        delay: r.delay
                    }
                };
                if (r.webhookUrl) {
                    rule.webhook = {
                        url: r.webhookUrl,
                        method: r.webhookMethod,
                        headers: r.webhookHeaders,
                        body: r.webhookBody,
                        delay: r.webhookDelay,
                        content_type: r.webhookContentType,
                        enabled: r.webhookEnabled
                    };
                }
                return rule;
            })
        };

        await this._putFile(owner, repo, branch, token,
            `${envSlug}/${groupSlug}/${routeSlug}.json`,
            JSON.stringify(routeData, null, 2),
            `MockHub sync: ${envName}/${groupName}/${route.pathPattern}`
        );
    }

    async _putFile(owner, repo, branch, token, path, content, message) {
        const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;

        // Check if file already exists (to get SHA for update)
        let sha = null;
        try {
            const existing = await this._githubRequest('GET', `${url}?ref=${branch}`, token);
            sha = existing.sha;
        } catch {
            // File doesn't exist yet, that's fine
        }

        const body = {
            message,
            content: Buffer.from(content).toString('base64'),
            branch
        };
        if (sha) body.sha = sha;

        return this._githubRequest('PUT', url, token, body);
    }
}

module.exports = new GitHubSyncService();
