const express = require('express');
const environmentController = require('../controllers/environmentController');
const groupController = require('../controllers/groupController');
const routeController = require('../controllers/routeController');
const ruleController = require('../controllers/ruleController');
const requestLogController = require('../controllers/requestLogController');
const exportImportController = require('../controllers/exportImportController');
const serverController = require('../controllers/serverController');

const router = express.Router();

// Environments
router.get('/environments', (req, res) => environmentController.getAll(req, res));
router.post('/environments', (req, res) => environmentController.create(req, res));
router.get('/environments/:id', (req, res) => environmentController.getById(req, res));
router.put('/environments/:id', (req, res) => environmentController.update(req, res));
router.delete('/environments/:id', (req, res) => environmentController.delete(req, res));
router.get('/environments/:id/tree', (req, res) => environmentController.getFullTree(req, res));
router.post('/environments/:id/copy', (req, res) => environmentController.copyToServer(req, res));

// Groups
router.get('/environments/:envId/groups', (req, res) => groupController.getByEnvironment(req, res));
router.post('/environments/:envId/groups', (req, res) => groupController.create(req, res));
router.put('/groups/:id', (req, res) => groupController.update(req, res));
router.delete('/groups/:id', (req, res) => groupController.delete(req, res));

// Routes
router.get('/groups/:groupId/routes', (req, res) => routeController.getByGroup(req, res));
router.post('/groups/:groupId/routes', (req, res) => routeController.create(req, res));
router.get('/routes/:id', (req, res) => routeController.getById(req, res));
router.put('/routes/:id', (req, res) => routeController.update(req, res));
router.delete('/routes/:id', (req, res) => routeController.delete(req, res));

// Rules
router.get('/routes/:routeId/rules', (req, res) => ruleController.getByRoute(req, res));
router.post('/routes/:routeId/rules', (req, res) => ruleController.create(req, res));
router.put('/rules/:id', (req, res) => ruleController.update(req, res));
router.delete('/rules/:id', (req, res) => ruleController.delete(req, res));

// Request Logs
router.get('/routes/:routeId/logs', (req, res) => requestLogController.getByRoute(req, res));
router.delete('/routes/:routeId/logs', (req, res) => requestLogController.clearByRoute(req, res));
router.get('/environments/:envId/logs', (req, res) => requestLogController.getByEnvironment(req, res));
router.delete('/environments/:envId/logs', (req, res) => requestLogController.clearByEnvironment(req, res));
router.delete('/logs/:id', (req, res) => requestLogController.delete(req, res));

// Export/Import
router.get('/environments/:id/export', (req, res) => exportImportController.exportEnvironment(req, res));
router.post('/environments/import', (req, res) => exportImportController.importEnvironment(req, res));

// Servers
router.get('/servers', (req, res) => serverController.getAll(req, res));
router.post('/servers', (req, res) => serverController.create(req, res));
router.put('/servers/:id', (req, res) => serverController.update(req, res));
router.delete('/servers/:id', (req, res) => serverController.delete(req, res));
router.post('/servers/:id/test', (req, res) => serverController.testConnection(req, res));
router.get('/servers/:id/environments', (req, res) => serverController.listRemoteEnvironments(req, res));
router.post('/servers/:id/pull', (req, res) => serverController.pull(req, res));
router.post('/servers/:id/push', (req, res) => serverController.push(req, res));
router.post('/servers/:id/push/group', (req, res) => serverController.pushGroup(req, res));
router.post('/servers/:id/push/route', (req, res) => serverController.pushRoute(req, res));
router.get('/servers/:id/sync-status', (req, res) => serverController.getSyncStatus(req, res));
router.post('/servers/:sourceId/copy/:targetId', (req, res) => serverController.copyEnvironment(req, res));

module.exports = router;
