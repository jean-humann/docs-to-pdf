import { promisify } from "util";
import { promises as fsPromises } from "fs";
import { execFile } from "child_process";
import { join as pathJoin, resolve as pathResolve } from "path";
import {expect, describe, test} from '@jest/globals';


const promiseExecFile = promisify(execFile);

jest.setTimeout(60_000);

const TEST_OUTPUT = "./tests/output";
// third-to-last docs path so should be faster
const DOCUSAURUS_TEST_LINK =
  "https://docusaurus.io/docs/";

async function runDocusaurusPdf(
  args: Array<string>,
  { cmd = require.resolve("../lib/cli.js"), cwd = process.cwd() } = {}
) {
  return await promiseExecFile("node", [cmd, ...args], { cwd });
}

async function isFile(path: string): Promise<boolean> {
  try {
    const stat = await fsPromises.stat(path);
    return stat.isFile();
  } catch (error) {
    return false;
    // throw error;
  }
}

async function rmdirRecursive(path: string): Promise<void> {
  let files;
  try {
    files = await fsPromises.readdir(path);
  } catch (error) {
    if (error.code === "ENOENT") {
      return; // dir already doesn't exist
    }
    throw error;
  }

  await Promise.all(
    files.map((file) => {
      return fsPromises.unlink(pathJoin(path, file));
    })
  );
  await fsPromises.rmdir(path);
}

describe("testing cli", () => {
  beforeAll(async () => {
    await rmdirRecursive(TEST_OUTPUT);
    await fsPromises.mkdir(TEST_OUTPUT);
  });

  describe("default", () => {
    test("should download docusaurus-website to default docusaurus.pdf", async () => {
      await runDocusaurusPdf([DOCUSAURUS_TEST_LINK], { cwd: TEST_OUTPUT });
      expect(await isFile(pathJoin(TEST_OUTPUT, "docusaurus.pdf"))).toBe(true);
    });
    test("should download docusaurus-website to specific location", async () => {
      const outputPath = pathJoin(TEST_OUTPUT, "specifc-loc-test.pdf");
      await runDocusaurusPdf([DOCUSAURUS_TEST_LINK, outputPath]);
      expect(await isFile(outputPath)).toBe(true);
    });
    test("should fail when using non-docusuarus url", async () => {
      const outputPath = pathJoin(TEST_OUTPUT, "should-fail.pdf");
      await expect(
        runDocusaurusPdf(["https://example.invalid", outputPath])
      ).rejects.toThrow();
      expect(await isFile(outputPath)).toBe(false);
    });
  });


});