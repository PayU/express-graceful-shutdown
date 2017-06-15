'use strict';
let _ = require('lodash'),
    httpShutdown = require('http-shutdown').extend();

let shuttingDown, server, events, logger, timeout, callback;
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
    timeout = Number(options.timeout);
    events = options.events || ['SIGINT', 'SIGTERM'];
    callback = options.callback;
    logger.trace('Registering shutdown events', events);
    [].concat(events).map((event) => { process.on(event, shutdown) });
};

function validateOptions(options) {
    if (!_.isArray(options.events) && typeof options.events !== 'string') {
    }
    if (options.callback && (typeof options.callback !== 'function' || typeof options.callback.then !== 'function')) {
        throw new Error('callback must be a function and must return a Promise');
    }
    if (isNaN(options.timeout)) {
        throw new Error('timeout is required and must be a number');
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
    logger.info({ message: `Shut down process initiated with graceful timeout of ${timeout} ms` });

    // Forcefully shutdown after the timeout expired
    var timeoutId = setTimeout(function () {
        logger.info({ msg: 'Not all connections were closed within the grace time. Closing all remaining connections forcefully' });
        tearDown();
    }, timeout);

    // Close express connections
    server.shutdown(function () {
        logger.info({ msg: 'All connections were closed gracefully' });
        clearTimeout(timeoutId);
        tearDown();
    });
};

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

function exit(code) {
    logger.info({ msg: 'Shut down process completed' });
    process.exit(code);
}

module.exports = {
    registerShutdownEvent: registerShutdownEvent
};