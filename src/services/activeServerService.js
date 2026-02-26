// In-memory store for the currently active server.
// null = Local, integer = GitHub server ID
let activeServerId = null;

module.exports = {
    get() {
        return activeServerId;
    },
    set(serverId) {
        activeServerId = serverId === 'local' || serverId === null || serverId === undefined
            ? null
            : parseInt(serverId, 10);
    }
};
