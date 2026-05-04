import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { info, success, error, warn, startSpinner, updateSpinner, stopSpinner, logger } from './logger.js';

describe('Logger utility', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('info', () => {
    it('should output a message to console.log', async () => {
      await info('hello info');
      expect(logSpy).toHaveBeenCalledTimes(1);
      // The message should be present (possibly wrapped in chalk color codes)
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('hello info');
    });
  });

  describe('success', () => {
    it('should output a message to console.log', async () => {
      await success('hello success');
      expect(logSpy).toHaveBeenCalledTimes(1);
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('hello success');
    });
  });

  describe('error', () => {
    it('should output a message to console.error', async () => {
      await error('hello error');
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const output = errorSpy.mock.calls[0][0] as string;
      expect(output).toContain('hello error');
    });
  });

  describe('warn', () => {
    it('should output a message to console.log', async () => {
      await warn('hello warn');
      expect(logSpy).toHaveBeenCalledTimes(1);
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('hello warn');
    });
  });

  describe('startSpinner', () => {
    it('should output a message (spinner or fallback)', async () => {
      await startSpinner('loading...');
      // In test environment, ora may or may not render to a TTY.
      // We just verify no error is thrown and the function completes.
      // Stop the spinner to clean up.
      await stopSpinner();
    });
  });

  describe('updateSpinner', () => {
    it('should not throw when no spinner is active (fallback to console.log)', async () => {
      await updateSpinner('updating...');
      expect(logSpy).toHaveBeenCalledWith('updating...');
    });
  });

  describe('stopSpinner', () => {
    it('should not throw when no spinner is active', async () => {
      await stopSpinner();
      // No error should be thrown
    });

    it('should accept a boolean parameter', async () => {
      await stopSpinner(false);
      // No error should be thrown
    });
  });

  describe('logger namespace', () => {
    it('should export all functions', () => {
      expect(logger.info).toBe(info);
      expect(logger.success).toBe(success);
      expect(logger.error).toBe(error);
      expect(logger.warn).toBe(warn);
      expect(logger.startSpinner).toBe(startSpinner);
      expect(logger.updateSpinner).toBe(updateSpinner);
      expect(logger.stopSpinner).toBe(stopSpinner);
    });
  });
});
