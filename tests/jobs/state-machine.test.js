import { describe, it, expect } from 'vitest';
import { canTransition, getNextStatuses, isTerminal } from '../../src/jobs/state-machine.js';
import { JobStatus } from '../../src/jobs/types.js';

describe('state-machine', () => {
  // ─── canTransition ───────────────────────────────────────────

  describe('canTransition', () => {
    describe('合法正向转换', () => {
      const validTransitions = [
        [JobStatus.RECEIVED, JobStatus.RENDERING],
        [JobStatus.RECEIVED, JobStatus.PRINTING],
        [JobStatus.RECEIVED, JobStatus.CANCELED],
        [JobStatus.RENDERING, JobStatus.PRINTING],
        [JobStatus.RENDERING, JobStatus.FAILED_RENDER],
        [JobStatus.RENDERING, JobStatus.TIMEOUT],
        [JobStatus.RENDERING, JobStatus.CANCELED],
        [JobStatus.PRINTING, JobStatus.DONE],
        [JobStatus.PRINTING, JobStatus.FAILED_PRINT],
      ];

      it.each(validTransitions)('%s -> %s 应返回 true', (from, to) => {
        expect(canTransition(from, to)).toBe(true);
      });
    });

    describe('重试路径', () => {
      it('failed_print -> received 应返回 true', () => {
        expect(canTransition(JobStatus.FAILED_PRINT, JobStatus.RECEIVED)).toBe(true);
      });

      it('failed_render -> received 应返回 true', () => {
        expect(canTransition(JobStatus.FAILED_RENDER, JobStatus.RECEIVED)).toBe(true);
      });
    });

    describe('非法转换', () => {
      const invalidTransitions = [
        [JobStatus.RECEIVED, JobStatus.DONE],
        [JobStatus.RECEIVED, JobStatus.FAILED_PRINT],
        [JobStatus.PRINTING, JobStatus.RENDERING],
        [JobStatus.PRINTING, JobStatus.CANCELED],
        [JobStatus.RENDERING, JobStatus.DONE],
        [JobStatus.RENDERING, JobStatus.RECEIVED],
      ];

      it.each(invalidTransitions)('%s -> %s 应返回 false', (from, to) => {
        expect(canTransition(from, to)).toBe(false);
      });
    });

    describe('终态不可转换到非重试目标', () => {
      const terminalNoExit = [
        [JobStatus.DONE, JobStatus.RECEIVED],
        [JobStatus.DONE, JobStatus.RENDERING],
        [JobStatus.DONE, JobStatus.PRINTING],
        [JobStatus.CANCELED, JobStatus.RECEIVED],
        [JobStatus.CANCELED, JobStatus.RENDERING],
        [JobStatus.TIMEOUT, JobStatus.RECEIVED],
        [JobStatus.TIMEOUT, JobStatus.RENDERING],
      ];

      it.each(terminalNoExit)('%s -> %s 应返回 false', (from, to) => {
        expect(canTransition(from, to)).toBe(false);
      });
    });

    it('未知状态应返回 false', () => {
      expect(canTransition('unknown', JobStatus.RECEIVED)).toBe(false);
    });
  });

  // ─── getNextStatuses ─────────────────────────────────────────

  describe('getNextStatuses', () => {
    it('received 应返回 [rendering, printing, canceled]', () => {
      expect(getNextStatuses(JobStatus.RECEIVED)).toEqual([
        JobStatus.RENDERING,
        JobStatus.PRINTING,
        JobStatus.CANCELED,
      ]);
    });

    it('rendering 应返回 [printing, failed_render, timeout, canceled]', () => {
      expect(getNextStatuses(JobStatus.RENDERING)).toEqual([
        JobStatus.PRINTING,
        JobStatus.FAILED_RENDER,
        JobStatus.TIMEOUT,
        JobStatus.CANCELED,
      ]);
    });

    it('printing 应返回 [done, failed_print]', () => {
      expect(getNextStatuses(JobStatus.PRINTING)).toEqual([
        JobStatus.DONE,
        JobStatus.FAILED_PRINT,
      ]);
    });

    it('done 应返回 []', () => {
      expect(getNextStatuses(JobStatus.DONE)).toEqual([]);
    });

    it('canceled 应返回 []', () => {
      expect(getNextStatuses(JobStatus.CANCELED)).toEqual([]);
    });

    it('timeout 应返回 []', () => {
      expect(getNextStatuses(JobStatus.TIMEOUT)).toEqual([]);
    });

    it('failed_print 应返回 [received]（重试路径）', () => {
      expect(getNextStatuses(JobStatus.FAILED_PRINT)).toEqual([JobStatus.RECEIVED]);
    });

    it('failed_render 应返回 [received]（重试路径）', () => {
      expect(getNextStatuses(JobStatus.FAILED_RENDER)).toEqual([JobStatus.RECEIVED]);
    });

    it('未知状态应返回 []', () => {
      expect(getNextStatuses('unknown')).toEqual([]);
    });
  });

  // ─── isTerminal ──────────────────────────────────────────────

  describe('isTerminal', () => {
    const terminalStatuses = [
      JobStatus.DONE,
      JobStatus.FAILED_RENDER,
      JobStatus.FAILED_PRINT,
      JobStatus.CANCELED,
      JobStatus.TIMEOUT,
    ];

    it.each(terminalStatuses)('%s 应为终态', (status) => {
      expect(isTerminal(status)).toBe(true);
    });

    const nonTerminalStatuses = [
      JobStatus.RECEIVED,
      JobStatus.RENDERING,
      JobStatus.PRINTING,
    ];

    it.each(nonTerminalStatuses)('%s 应为非终态', (status) => {
      expect(isTerminal(status)).toBe(false);
    });

    it('未知状态应为非终态', () => {
      expect(isTerminal('unknown')).toBe(false);
    });
  });
});
