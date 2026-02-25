const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    parseTagValue: true,
    trimValues: true
});

/**
 * Middleware that parses XML request bodies into req.body as a JS object.
 * Works alongside bodyParser.text which captures XML as a raw string.
 * Stores original XML in req.rawXmlBody for logging.
 */
function xmlParser(req, res, next) {
    const contentType = req.headers['content-type'] || '';
    const isXml = contentType.includes('xml');

    if (isXml && typeof req.body === 'string' && req.body.trim()) {
        try {
            req.rawXmlBody = req.body;
            req.body = parser.parse(req.body);
        } catch (e) {
            // If parsing fails, keep original string body
            req.rawXmlBody = req.body;
        }
    }

    next();
}

module.exports = { xmlParser };
