import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile as fsReadFile, mkdir, writeFile as nodeWriteFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeFile, mkdirp, directoryExists, isDirectoryEmpty, cleanupPaths } from './fs.js';

describe('fs utils', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'fs-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('writeFile', () => {
    it('should write content to a file', async () => {
      const filePath = join(tempDir, 'hello.txt');
      const result = await writeFile(filePath, 'hello world');

      expect(result).toBeUndefined();
      const content = await fsReadFile(filePath, 'utf-8');
      expect(content).toBe('hello world');
    });

    it('should create parent directories automatically', async () => {
      const filePath = join(tempDir, 'a', 'b', 'c', 'deep.txt');
      const result = await writeFile(filePath, 'deep content');

      expect(result).toBeUndefined();
      const content = await fsReadFile(filePath, 'utf-8');
      expect(content).toBe('deep content');
    });

    it('should return an error object on failure', async () => {
      // Attempt to write to a path where a directory exists with the same name
      const dirPath = join(tempDir, 'conflict');
      await mkdir(dirPath, { recursive: true });
      // Try to write a file at a path that is actually a directory
      const result = await writeFile(dirPath, 'content');

      expect(result).toBeDefined();
      expect(result!.file).toBe(dirPath);
      expect(typeof result!.error).toBe('string');
      expect(result!.error.length).toBeGreaterThan(0);
    });
  });

  describe('mkdirp', () => {
    it('should create a directory recursively', async () => {
      const dirPath = join(tempDir, 'x', 'y', 'z');
      await mkdirp(dirPath);

      expect(await directoryExists(dirPath)).toBe(true);
    });

    it('should succeed silently if directory already exists', async () => {
      const dirPath = join(tempDir, 'existing');
      await mkdir(dirPath);

      await expect(mkdirp(dirPath)).resolves.toBeUndefined();
    });
  });

  describe('directoryExists', () => {
    it('should return true for an existing directory', async () => {
      expect(await directoryExists(tempDir)).toBe(true);
    });

    it('should return false for a non-existent path', async () => {
      expect(await directoryExists(join(tempDir, 'nope'))).toBe(false);
    });

    it('should return false for a file path', async () => {
      const filePath = join(tempDir, 'file.txt');
      await nodeWriteFile(filePath, 'data');

      expect(await directoryExists(filePath)).toBe(false);
    });
  });

  describe('isDirectoryEmpty', () => {
    it('should return true for an empty directory', async () => {
      const emptyDir = join(tempDir, 'empty');
      await mkdir(emptyDir);

      expect(await isDirectoryEmpty(emptyDir)).toBe(true);
    });

    it('should return false for a non-empty directory', async () => {
      const filePath = join(tempDir, 'file.txt');
      await nodeWriteFile(filePath, 'data');

      expect(await isDirectoryEmpty(tempDir)).toBe(false);
    });

    it('should return true for a non-existent directory', async () => {
      expect(await isDirectoryEmpty(join(tempDir, 'missing'))).toBe(true);
    });
  });

  describe('cleanupPaths', () => {
    it('should remove files and directories in reverse order', async () => {
      const dir = join(tempDir, 'project');
      const subDir = join(dir, 'src');
      const file = join(subDir, 'index.ts');

      await mkdir(subDir, { recursive: true });
      await nodeWriteFile(file, 'content');

      // Paths in creation order — cleanup reverses them
      await cleanupPaths([dir, subDir, file]);

      expect(await directoryExists(dir)).toBe(false);
    });

    it('should silently ignore already-removed paths', async () => {
      const missingFile = join(tempDir, 'gone.txt');
      const missingDir = join(tempDir, 'vanished');

      // Should not throw
      await expect(cleanupPaths([missingDir, missingFile])).resolves.toBeUndefined();
    });

    it('should handle an empty paths array', async () => {
      await expect(cleanupPaths([])).resolves.toBeUndefined();
    });
  });
});
