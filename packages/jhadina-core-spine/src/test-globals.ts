import {
  after as nodeAfter,
  afterEach as nodeAfterEach,
  before as nodeBefore,
  beforeEach as nodeBeforeEach,
  describe as nodeDescribe,
  it as nodeIt,
  test as nodeTest,
} from 'node:test';

declare global {
  var after: typeof nodeAfter;
  var afterEach: typeof nodeAfterEach;
  var before: typeof nodeBefore;
  var beforeEach: typeof nodeBeforeEach;
  var describe: typeof nodeDescribe;
  var it: typeof nodeIt;
  var test: typeof nodeTest;
}

Object.assign(globalThis, {
  after: nodeAfter,
  afterEach: nodeAfterEach,
  before: nodeBefore,
  beforeEach: nodeBeforeEach,
  describe: nodeDescribe,
  it: nodeIt,
  test: nodeTest,
});

export {};
