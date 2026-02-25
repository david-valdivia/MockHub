module.exports = {
    port: process.env.PORT || 1995,
    environment: process.env.NODE_ENV || 'development',
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true
    },
    bodyParser: {
        json: { limit: '10mb' },
        urlencoded: { extended: true, limit: '10mb' },
        text: { type: ['text/plain', 'text/html', 'application/xml', 'text/xml'], limit: '10mb' },
        raw: { limit: '10mb' }
    }
};