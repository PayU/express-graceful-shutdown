const index = require('../index'), // file on test
    mockExpress = require('mock-express')(),
    should = require('should'),
    sinon = require('sinon');

describe('When registering to Graceful shutdown', () => {

    describe('When options object is not valid', () => {
        it('Should throw error when events is not a string or array', () => {
            try {
                index.registerShutdownEvent({
                    events: null
                });
                throw Error('The test should not exists at this point');
            } catch (error) {
                should.exist(error);
                should(error.message).eql('events is required and must be a string or array of strings');
            }
        });
        it('Should throw error when callback is not a function', () => {
            try {
                index.registerShutdownEvent({
                    events: ['event'],
                    callback: 'notValidCallback'
                });
                throw Error('The test should not exists at this point');
            } catch (error) {
                should.exist(error);
                should(error.message).eql('callback must be a function and must return a Promise');
            }
        });
        it('Should throw error when newConnectionsTimeout is not a number', () => {
            try {
                index.registerShutdownEvent({
                    events: ['event'],
                    callback: function() {},
                    newConnectionsTimeout: 'notValidTimeout'
                });
                throw Error('The test should not exists at this point');
            } catch (error) {
                should.exist(error);
                should(error.message).eql('newConnectionsTimeout is required and must be a number that represents milliseconds time');
            }
        });
        it('Should throw error when shutDownTimeout is not a number', () => {
            try {
                index.registerShutdownEvent({
                    events: ['event'],
                    callback: function() {},
                    newConnectionsTimeout: '5000',
                    shutDownTimeout: 'notValidShutdownTimeout'
                });
                throw Error('The test should not exists at this point');
            } catch (error) {
                should.exist(error);
                should(error.message).eql('shutDownTimeout is required and must be a number');
            }
        });
        it('Should throw error when server is not a exists', () => {
            try {
                index.registerShutdownEvent({
                    events: ['event'],
                    callback: function() {},
                    newConnectionsTimeout: '5000',
                    shutDownTimeout: '10000',
                    server: null
                });
                throw Error('The test should not exists at this point');
            } catch (error) {
                should.exist(error);
                should(error.message).eql('server is required and must be an express instance');
            }
        });
        it('should throw error when logger is not exists', () => {
            try {
                index.registerShutdownEvent({
                    events: ['event'],
                    callback: function() {},
                    newConnectionsTimeout: '5000',
                    shutDownTimeout: '10000',
                    server: {},
                    logger: null
                });
                throw Error('The test should not exists at this point');
            } catch (error) {
                should.exist(error);
            }
        });
        it('should throw error when logger is exists but not all required function exists', () => {
            try {
                index.registerShutdownEvent({
                    events: ['event'],
                    callback: function() {},
                    newConnectionsTimeout: '5000',
                    shutDownTimeout: '10000',
                    server: {},
                    logger: {
                        error: function() {}
                    }
                });
                throw Error('The test should not exists at this point');
            } catch (error) {
                should.exist(error);
            }
        });
    });

    describe('When server instance is not express instance', () => {
        it('Should throw error before register to the events', () => {
            try {
                index.registerShutdownEvent({
                    events: ['event'],
                    callback: function() {},
                    newConnectionsTimeout: '5000',
                    shutDownTimeout: '10000',
                    server: {},
                    logger: {
                        error: function() {},
                        info: function() {},
                        trace: function() {}
                    }
                });
                throw Error('The test should not exists at this point');
            } catch (error) {
                should.exist(error);
                should(error.message).eql('server must be an express server instance');
            }
        });
    });

    describe('When registration is successful', () => {
        let sandbox = sinon.sandbox.create(),
            processOnSpy,
            exitStub,
            validOptions;

        beforeEach(() => {
            exitStub = sandbox.stub(process, 'exit');
            processOnSpy = sandbox.spy(process, 'on');

            validOptions = {
                events: ['event'],
                newConnectionsTimeout: '10',
                shutDownTimeout: '10',
                server: mockExpress,
                logger: {
                    error: function() {},
                    info: function() {},
                    trace: function() {}
                }
            };
        });

        afterEach(() => { sandbox.restore() });

        mockExpress.withShutdown = function() {
            return this;
        };

        it('Should register the specified event', () => {
            validOptions.events = 'eventToRegister';

            index.registerShutdownEvent(validOptions);
            processOnSpy.calledWith('eventToRegister').should.equal(true);
        });
        it('Should register multiple events', () => {
            validOptions.events = ['eventToRegister1', 'eventToRegister2'];

            index.registerShutdownEvent(validOptions);
            processOnSpy.calledWith('eventToRegister1').should.equal(true);
            processOnSpy.calledWith('eventToRegister2').should.equal(true);
        });
        it('Should initiate graceful shutdown and shutdown when all connection were closed', function(done){
            // Trigger server close immediately
            validOptions.server.shutdown = function(cb){
                cb();
            };

            index.registerShutdownEvent(validOptions);

            process.emit(validOptions.events[0]);
            setTimeout(function () {
                exitStub.called.should.equal(true);
                exitStub.calledWith().should.equal(true);
                done();
            }, 30);

        });
        it('Should forcefully shutdown when graceful shutdown timeout expires', function(done){
            let clock = sandbox.useFakeTimers(new Date().getTime());
            validOptions.server.shutdown = function(){};

            index.registerShutdownEvent(validOptions);

            process.emit(validOptions.events[0]);
            clock.tick(2);
            exitStub.called.should.equal(false);

            clock.tick(100);
            clock.restore();
            setTimeout(function () {
                exitStub.called.should.equal(true);
                exitStub.calledWith().should.equal(true);
                done();
            }, 20);
        });
        it('Should only initiate graceful shutdown process once for multiple events', function (done) {
            let callCount = 0;
            validOptions.server.shutdown = function(){
                callCount++;
            };

            index.registerShutdownEvent(validOptions);

            process.emit(validOptions.events[0]);
            process.emit(validOptions.events[0]);
            process.emit(validOptions.events[0]);

            setTimeout(function () {
                callCount.should.equal(1);
                done();
            }, 30);
        });
        it('Should initiate graceful shutdown and shutdown when callback is valid and returned', function(done) {
            // Trigger server close immediately
            validOptions.server.shutdown = function(cb){
                cb();
            };

            validOptions.callback = function() {
                return new Promise((resolve) => {
                    return resolve();
                })
            };

            index.registerShutdownEvent(validOptions);

            process.emit(validOptions.events[0]);

            setTimeout(function () {
                exitStub.called.should.equal(true);
                exitStub.calledWith().should.equal(true);
                done();
            }, 30);

        });
    });

});