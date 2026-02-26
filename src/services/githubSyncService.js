const environmentRepo = require('../repositories/environmentRepository');
const groupRepo = require('../repositories/groupRepository');
const routeRepo = require('../repositories/routeRepository');
const ruleRepo = require('../repositories/ruleRepository');
const serverRepo = require('../repositories/serverRepository');
const syncTrackingRepo = require('../repositories/syncTrackingRepository');
const contentHashService = require('./contentHashService');
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

        const repoInfo = await this._githubRequest(
            'GET',
            `${GITHUB_API}/repos/${owner}/${repo}`,
            token
        );

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
                return [];
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

        const envFile = await this._githubRequest(
            'GET',
            `${GITHUB_API}/repos/${owner}/${repo}/contents/${envSlug}/_environment.json?ref=${branch}`,
            serverRow.token
        );
        const envData = JSON.parse(Buffer.from(envFile.content, 'base64').toString('utf-8'));

        const envContents = await this._githubRequest(
            'GET',
            `${GITHUB_API}/repos/${owner}/${repo}/contents/${envSlug}?ref=${branch}`,
            serverRow.token
        );

        const groupDirs = envContents.filter(item => item.type === 'dir');
        const groups = [];

        for (const groupDir of groupDirs) {
            let groupData = { name: groupDir.name, sort_order: 0 };
            try {
                const groupFile = await this._githubRequest(
                    'GET',
                    `${GITHUB_API}/repos/${owner}/${repo}/contents/${envSlug}/${groupDir.name}/_group.json?ref=${branch}`,
                    serverRow.token
                );
                groupData = JSON.parse(Buffer.from(groupFile.content, 'base64').toString('utf-8'));
            } catch {
                // Use defaults
            }

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

    async importPulledEnvironment(importData, serverId = null) {
        const envData = importData.environment;
        let basePath = Environment.sanitizeBasePath(envData.base_path);

        let counter = 1;
        while (await environmentRepo.exists(basePath, serverId)) {
            basePath = Environment.sanitizeBasePath(envData.base_path) + '-' + counter;
            counter++;
        }

        const env = await environmentRepo.create({
            name: envData.name,
            base_path: basePath,
            description: envData.description || '',
            slug: this.slugify(envData.name),
            server_id: serverId
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

            await this._putFile(owner, repo, branch, serverRow.token,
                `${envSlug}/${groupSlug}/_group.json`,
                JSON.stringify({ name: group.name, sort_order: group.sortOrder }, null, 2),
                `MockHub sync: ${env.name}/${group.name}`
            );

            for (const route of routes) {
                await this._pushSingleRoute(owner, repo, branch, serverRow.token, envSlug, groupSlug, env.name, group.name, route);
            }
        }

        // Record sync tracking with content hashes
        const envHash = await contentHashService.envHash(env.id);
        await syncTrackingRepo.recordPush(serverRow.id, 'environment', env.id, envHash);

        for (const group of groups) {
            const groupHash = await contentHashService.groupHash(group.id);
            await syncTrackingRepo.recordPush(serverRow.id, 'group', group.id, groupHash);
            const groupRoutes = await routeRepo.findByGroupId(group.id);
            for (const route of groupRoutes) {
                const routeHash = await contentHashService.routeWithRulesHash(route.id);
                await syncTrackingRepo.recordPush(serverRow.id, 'route', route.id, routeHash);
                const rules = await ruleRepo.findByRouteId(route.id);
                for (const rule of rules) {
                    const ruleHash = contentHashService.hash(contentHashService.ruleContent(rule));
                    await syncTrackingRepo.recordPush(serverRow.id, 'rule', rule.id, ruleHash);
                }
            }
        }

        // Write _metadata.json
        const metadata = await contentHashService.buildEnvironmentMetadata(envId);
        await this._putFile(owner, repo, branch, serverRow.token,
            `${envSlug}/_metadata.json`,
            JSON.stringify(metadata, null, 2),
            `MockHub metadata: ${env.name}`
        );

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

        await this._putFile(owner, repo, branch, serverRow.token,
            `${envSlug}/_environment.json`,
            JSON.stringify({ name: env.name, base_path: env.basePath, description: env.description }, null, 2),
            `MockHub sync: ${env.name}`
        );

        await this._putFile(owner, repo, branch, serverRow.token,
            `${envSlug}/${groupSlug}/_group.json`,
            JSON.stringify({ name: group.name, sort_order: group.sortOrder }, null, 2),
            `MockHub sync: ${env.name}/${group.name}`
        );

        for (const route of routes) {
            await this._pushSingleRoute(owner, repo, branch, serverRow.token, envSlug, groupSlug, env.name, group.name, route);
            const routeHash = await contentHashService.routeWithRulesHash(route.id);
            await syncTrackingRepo.recordPush(serverRow.id, 'route', route.id, routeHash);
            const rules = await ruleRepo.findByRouteId(route.id);
            for (const rule of rules) {
                const ruleHash = contentHashService.hash(contentHashService.ruleContent(rule));
                await syncTrackingRepo.recordPush(serverRow.id, 'rule', rule.id, ruleHash);
            }
        }

        const envHash = await contentHashService.envHash(env.id);
        await syncTrackingRepo.recordPush(serverRow.id, 'environment', env.id, envHash);
        const groupHash = await contentHashService.groupHash(group.id);
        await syncTrackingRepo.recordPush(serverRow.id, 'group', group.id, groupHash);

        // Update _metadata.json
        const metadata = await contentHashService.buildEnvironmentMetadata(env.id);
        await this._putFile(owner, repo, branch, serverRow.token,
            `${envSlug}/_metadata.json`,
            JSON.stringify(metadata, null, 2),
            `MockHub metadata: ${env.name}`
        );

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

        await this._putFile(owner, repo, branch, serverRow.token,
            `${envSlug}/_environment.json`,
            JSON.stringify({ name: env.name, base_path: env.basePath, description: env.description }, null, 2),
            `MockHub sync: ${env.name}`
        );

        await this._putFile(owner, repo, branch, serverRow.token,
            `${envSlug}/${groupSlug}/_group.json`,
            JSON.stringify({ name: group.name, sort_order: group.sortOrder }, null, 2),
            `MockHub sync: ${env.name}/${group.name}`
        );

        await this._pushSingleRoute(owner, repo, branch, serverRow.token, envSlug, groupSlug, env.name, group.name, route);

        const envHash = await contentHashService.envHash(env.id);
        await syncTrackingRepo.recordPush(serverRow.id, 'environment', env.id, envHash);
        const groupHash = await contentHashService.groupHash(group.id);
        await syncTrackingRepo.recordPush(serverRow.id, 'group', group.id, groupHash);
        const routeHash = await contentHashService.routeWithRulesHash(route.id);
        await syncTrackingRepo.recordPush(serverRow.id, 'route', route.id, routeHash);
        const rules = await ruleRepo.findByRouteId(route.id);
        for (const rule of rules) {
            const ruleHash = contentHashService.hash(contentHashService.ruleContent(rule));
            await syncTrackingRepo.recordPush(serverRow.id, 'rule', rule.id, ruleHash);
        }

        // Update _metadata.json
        const metadata = await contentHashService.buildEnvironmentMetadata(env.id);
        await this._putFile(owner, repo, branch, serverRow.token,
            `${envSlug}/_metadata.json`,
            JSON.stringify(metadata, null, 2),
            `MockHub metadata: ${env.name}`
        );

        await serverRepo.update(serverRow.id, { last_sync: new Date().toISOString() });
        return { success: true, envSlug, groupSlug, routeSlug: route.slug || this.slugify(route.pathPattern) };
    }

    async copyEnvironment(sourceServerRow, targetServerRow, envSlug) {
        const importData = await this.pullEnvironment(sourceServerRow, envSlug);
        const env = await this.importPulledEnvironment(importData, targetServerRow.id);
        await this.pushEnvironment(targetServerRow, env.id);
        return env;
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

        let sha = null;
        try {
            const existing = await this._githubRequest('GET', `${url}?ref=${branch}`, token);
            sha = existing.sha;
        } catch {
            // File doesn't exist yet
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
