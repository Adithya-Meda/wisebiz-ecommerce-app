'use strict';

/**
 * Tests for shared/logger.js
 * Verifies both JSON and text output modes behave correctly.
 */

describe('shared/logger', () => {
  let originalLogFormat;
  let originalNodeEnv;

  beforeEach(() => {
    originalLogFormat = process.env.LOG_FORMAT;
    originalNodeEnv   = process.env.NODE_ENV;
    jest.resetModules(); // force fresh require so LOG_FORMAT env is re-read
  });

  afterEach(() => {
    process.env.LOG_FORMAT = originalLogFormat;
    process.env.NODE_ENV   = originalNodeEnv;
    jest.resetModules();
  });

  describe('Text mode (LOG_FORMAT=text)', () => {
    it('emits a human-readable string', () => {
      process.env.LOG_FORMAT = 'text';
      process.env.NODE_ENV   = 'development';
      process.env.LOG_LEVEL  = 'debug';

      const { createLogger } = require('../../shared/logger');
      const logger = createLogger('test-svc');
      const spy = jest.spyOn(console, 'info').mockImplementation(() => {});

      logger.info('Hello world', { key: 'value' });

      expect(spy).toHaveBeenCalledTimes(1);
      const output = spy.mock.calls[0][0];
      expect(typeof output).toBe('string');
      expect(output).toContain('[test-svc]');
      expect(output).toContain('Hello world');
      // Must NOT be parseable as JSON
      expect(() => JSON.parse(output)).toThrow();

      spy.mockRestore();
    });
  });

  describe('JSON mode (LOG_FORMAT=json)', () => {
    it('emits valid JSON with required fields', () => {
      process.env.LOG_FORMAT = 'json';
      process.env.NODE_ENV   = 'development';
      process.env.LOG_LEVEL  = 'debug';

      const { createLogger } = require('../../shared/logger');
      const logger = createLogger('test-svc');
      const spy = jest.spyOn(console, 'info').mockImplementation(() => {});

      logger.info('Hello JSON', { requestId: 'abc-123' });

      expect(spy).toHaveBeenCalledTimes(1);
      const output = spy.mock.calls[0][0];

      let parsed;
      expect(() => { parsed = JSON.parse(output); }).not.toThrow();
      expect(parsed).toMatchObject({
        level:     'info',
        service:   'test-svc',
        message:   'Hello JSON',
        requestId: 'abc-123',    // meta fields flattened into entry
      });
      expect(parsed.timestamp).toBeDefined();

      spy.mockRestore();
    });
  });

  describe('Production mode auto-selects JSON', () => {
    it('uses JSON when NODE_ENV=production and LOG_FORMAT is unset', () => {
      delete process.env.LOG_FORMAT;
      process.env.NODE_ENV  = 'production';
      process.env.LOG_LEVEL = 'debug';

      const { createLogger } = require('../../shared/logger');
      const logger = createLogger('prod-svc');
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      logger.error('Something broke', { code: 500 });

      expect(spy).toHaveBeenCalledTimes(1);
      const output = spy.mock.calls[0][0];
      let parsed;
      expect(() => { parsed = JSON.parse(output); }).not.toThrow();
      expect(parsed.level).toBe('error');

      spy.mockRestore();
    });

    it('falls back to text when NODE_ENV=production and LOG_FORMAT=text', () => {
      process.env.LOG_FORMAT = 'text';
      process.env.NODE_ENV   = 'production';
      process.env.LOG_LEVEL  = 'debug';

      const { createLogger } = require('../../shared/logger');
      const logger = createLogger('prod-svc');
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      logger.warn('Text override');

      const output = spy.mock.calls[0][0];
      expect(() => JSON.parse(output)).toThrow();

      spy.mockRestore();
    });
  });

  describe('Log level filtering', () => {
    it('suppresses debug logs when LOG_LEVEL=info', () => {
      process.env.LOG_FORMAT = 'text';
      process.env.LOG_LEVEL  = 'info';

      const { createLogger } = require('../../shared/logger');
      const logger = createLogger('test-svc');
      const spy = jest.spyOn(console, 'debug').mockImplementation(() => {});

      logger.debug('This should not appear');

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('emits error logs when LOG_LEVEL=error', () => {
      process.env.LOG_FORMAT = 'text';
      process.env.LOG_LEVEL  = 'error';

      const { createLogger } = require('../../shared/logger');
      const logger = createLogger('test-svc');
      const infoSpy  = jest.spyOn(console, 'info').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      logger.info('Should be suppressed');
      logger.error('Should appear');

      expect(infoSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(1);

      infoSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
