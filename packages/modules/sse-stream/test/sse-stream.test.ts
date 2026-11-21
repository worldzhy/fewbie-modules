import { deferred } from "@testing/deferred";

import { consumeSseStream } from "../src/lib/sse-stream";

test("concurrent streams do not steal each other's multibyte bytes", async () => {
  const encoder = new TextEncoder();
  const firstChunkRead = deferred<void>();
  const releaseSecondChunk = deferred<void>();
  const signal = new AbortController().signal;

  const bytesA = encoder.encode("data: 你好\n\n");
  // Split inside the first CJK character: skip the ASCII prefix, then cut the
  // 3-byte sequence after 2 bytes.
  const cut = "data: ".length + 2;
  let step = 0;
  const streamA = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (step === 0) {
        controller.enqueue(bytesA.slice(0, cut));
        step = 1;
        firstChunkRead.resolve();
        await releaseSecondChunk.promise;
        return;
      }
      if (step === 1) {
        controller.enqueue(bytesA.slice(cut));
        step = 2;
        return;
      }
      controller.close();
    },
  });

  const streamB = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("data: 世界\n\n"));
      controller.close();
    },
  });

  const framesA: string[] = [];
  const framesB: string[] = [];

  const runA = consumeSseStream(streamA, signal, (frame) => framesA.push(frame.data));
  await firstChunkRead.promise;
  // Let stream A decode the partial chunk into its own decoder state.
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Stream B runs to completion while A still holds an incomplete sequence.
  await consumeSseStream(streamB, signal, (frame) => framesB.push(frame.data));

  releaseSecondChunk.resolve();
  await runA;

  expect(framesA).toEqual(["你好"]);
  expect(framesB).toEqual(["世界"]);
});
