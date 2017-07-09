'use strict';
let _ = require('lodash'),
    httpShutdown = require('http-shutdown').extend();

let shuttingDown, server, events, logger, newConnectionsTimeout, shutDownTimeout, closeAllConnectionsTimeoutId, callback;
const REQUIRED_LOGGER_IMPLEMENTATIONS = ['trace', 'info', 'error'];

function registerShutdownEvent(options) {
    validateOptions(options);
    try {
        server = options.server.withShutdown();
    } catch (error) {
        throw new Error('server must be an express server instance');
    }
    shuttingDown = false;
    logger = options.logger;
    shutDownTimeout = Number(options.shutdownTimeout);
    newConnectionsTimeout = Number(options.newConnectionsTimeout);
    events = options.events || ['SIGINT', 'SIGTERM'];
    callback = options.callback;
    logger.trace('Registering shutdown events', events);
    [].concat(events).map((event) => { process.on(event, shutdown) });
}

function validateOptions(options) {
    if (!_.isArray(options.events) && typeof options.events !== 'string') {
        throw new Error('events is required and must be a string or array of strings');
    }
    if (options.callback && typeof options.callback !== 'function') {
        throw new Error('callback must be a function and must return a Promise');
    }
    if (options.newConnectionsTimeout && isNaN(options.newConnectionsTimeout)) {
        throw new Error('newConnectionsTimeout must be a positive number');
    }
    if (isNaN(options.shutdownTimeout) || options.shutdownTimeout <= 0) {
        throw new Error('shutdownTimeout is required and must be a number greater then 0');
    }
    if (!options.server) {
        throw new Error('server is required and must be an express instance');
    }
    let loggerImplementsRequiredFunctions = _.every(REQUIRED_LOGGER_IMPLEMENTATIONS, (implementation) => {
        return typeof options.logger[implementation] === 'function';
    });
    if (!options.logger || !loggerImplementsRequiredFunctions) {
        throw new Error(`logger with required implementations is required [${REQUIRED_LOGGER_IMPLEMENTATIONS}]`);
    }
}

function shutdown() {
    // No need to execute the function if we already initiated the shutdown process
    if (shuttingDown) return;

    shuttingDown = true;
    logger.info({ msg: `Shut down process initiated with graceful timeout of ${shutDownTimeout + newConnectionsTimeout}  ms`});

    setTimeout(() => {
        logger.info({msg: 'Server close event initiated. service wont except new connections now.'});

        startGracefulShutdownPeriod();

        // Close express connections
        server.shutdown(function () {
            logger.info({ msg: 'All connections were closed gracefully' });
            clearTimeout(closeAllConnectionsTimeoutId);
            tearDown();
        });

    }, newConnectionsTimeout);
}

function tearDown() {
    if (callback) {
        return callback()
            .then(() => {
                logger.info({ msg: 'Callback function executed successfully' });
                exit(0);
            })
            .catch((error) => {
                logger.error({ msg: 'Callback function executation failed', error: error });
                exit(1);
            });
    } else {
        exit(0);
    }
}

function startGracefulShutdownPeriod() {
    closeAllConnectionsTimeoutId = setTimeout(function (){
        logger.info({ msg: 'Not all connections were closed within the grace time. Closing all remaining connections forcefully' });
        tearDown();
    }, shutDownTimeout);
}

function exit(code) {
    logger.info({ msg: 'Shut down process completed' });
    process.exit(code);
}

module.exports = {
    registerShutdownEvent: registerShutdownEvent
};