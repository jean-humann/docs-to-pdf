import { generatePDF } from '../src/core';
import { acquire } from '../src/acquire';
import { render } from '../src/render';
import { AcquireIR } from '../src/ir';

jest.mock('../src/acquire');
jest.mock('../src/render');

const mockedAcquire = acquire as jest.MockedFunction<typeof acquire>;
const mockedRender = render as jest.MockedFunction<typeof render>;

describe('generatePDF orchestration (acquire -> render)', () => {
  let ir: AcquireIR;

  beforeEach(() => {
    jest.clearAllMocks();
    ir = {
      chunks: [],
      baseOrigin: '',
      firstInitialURL: '',
      coverImage: null,
    };
    mockedAcquire.mockResolvedValue(ir);
    mockedRender.mockResolvedValue(undefined);
  });

  it('calls acquire(options) exactly once, then render(ir, options) exactly once', async () => {
    const options = { initialDocURLs: ['http://x/p1'] } as never;

    await generatePDF(options);

    expect(mockedAcquire).toHaveBeenCalledTimes(1);
    expect(mockedAcquire).toHaveBeenCalledWith(options);
    expect(mockedRender).toHaveBeenCalledTimes(1);
    expect(mockedRender).toHaveBeenCalledWith(ir, options);
  });

  it('passes the EXACT object identity returned by acquire into render', async () => {
    const options = { initialDocURLs: ['http://x/p1'] } as never;

    await generatePDF(options);

    expect(mockedRender).toHaveBeenCalledTimes(1);
    const passedIr = mockedRender.mock.calls[0][0];
    expect(passedIr).toBe(ir);
  });

  it('invokes acquire before render', async () => {
    const order: string[] = [];
    mockedAcquire.mockImplementation(async () => {
      order.push('acquire');
      return ir;
    });
    mockedRender.mockImplementation(async () => {
      order.push('render');
    });

    await generatePDF({ initialDocURLs: ['http://x/p1'] } as never);

    expect(order).toEqual(['acquire', 'render']);
    expect(mockedAcquire.mock.invocationCallOrder[0]).toBeLessThan(
      mockedRender.mock.invocationCallOrder[0],
    );
  });

  it('still invokes acquire when concurrency is omitted in options', async () => {
    const options = { initialDocURLs: ['http://x/p1'] } as never;
    expect((options as { concurrency?: number }).concurrency).toBeUndefined();

    await generatePDF(options);

    expect(mockedAcquire).toHaveBeenCalledTimes(1);
    expect(mockedAcquire).toHaveBeenCalledWith(options);
  });
});
