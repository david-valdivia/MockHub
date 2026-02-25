const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const path = require('path');

const config = require('./src/config/server');
const database = require('./src/config/database');
const socketService = require('./src/services/socketService');

const apiRoutes = require('./src/routes/api');
const webhookRoutes = require('./src/routes/webhook');
const apiV2Routes = require('./src/routes/apiV2');
const mockRoutingEngine = require('./src/services/mockRoutingEngine');

const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { requestLogger } = require('./src/middleware/requestLogger');
const { xmlParser } = require('./src/middleware/xmlParser');

class Application {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server);
    }

    async initialize() {
        try {
            await database.initialize();
            this.setupMiddleware();
            this.setupRoutes();
            this.setupSocketIO();
            this.setupErrorHandling();
            
            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            process.exit(1);
        }
    }

    setupMiddleware() {
        this.app.use(bodyParser.json(config.bodyParser.json));
        this.app.use(bodyParser.urlencoded(config.bodyParser.urlencoded));
        this.app.use(bodyParser.text(config.bodyParser.text));
        this.app.use(bodyParser.raw(config.bodyParser.raw));
        this.app.use(xmlParser);

        this.app.use(express.static(path.join(__dirname, 'public')));

        if (config.environment === 'development') {
            this.app.use(requestLogger);
        }
    }

    setupRoutes() {
        // API routes
        this.app.use('/api', apiRoutes);

        // API v2 routes (MockHub)
        this.app.use('/api/v2', apiV2Routes);

        // Check if Vue build exists, otherwise serve original HTML
        const vueBuildPath = path.join(__dirname, 'public-vue');
        const originalPublicPath = path.join(__dirname, 'public');
        
        if (require('fs').existsSync(vueBuildPath)) {
            // Serve Vue.js build
            this.app.use(express.static(vueBuildPath));
            // SPA fallback: serve index.html for frontend routes
            this.app.get(/^\/(mock(\/.*)?)?$/, (req, res) => {
                res.sendFile(path.join(vueBuildPath, 'index.html'));
            });
        } else {
            // Fallback to original public folder
            this.app.get('/', (req, res) => {
                res.sendFile(path.join(originalPublicPath, 'index.html'));
            });
        }

        // Mock routing engine (must be before legacy webhook routes)
        this.app.use((req, res, next) => mockRoutingEngine.handleRequest(req, res, next));

        // Legacy webhook routes (fallback)
        this.app.use(webhookRoutes);
    }

    setupSocketIO() {
        socketService.initialize(this.io);
    }

    setupErrorHandling() {
        this.app.use(notFoundHandler);
        this.app.use(errorHandler);
    }

    async start() {
        try {
            await this.initialize();
            
            this.server.listen(config.port, () => {
                console.log(`Server running on port ${config.port}`);
                console.log(`Environment: ${config.environment}`);
                console.log(`Open http://localhost:${config.port} in your browser`);
            });

            this.setupGracefulShutdown();
        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    setupGracefulShutdown() {
        const gracefulShutdown = async (signal) => {
            console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
            
            this.server.close((err) => {
                if (err) {
                    console.error('Error during server shutdown:', err);
                    process.exit(1);
                }
                
                console.log('Server closed successfully');
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }
}

if (require.main === module) {
    const app = new Application();
    app.start().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = Application;