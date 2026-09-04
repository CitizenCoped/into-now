/**
 * Minimal typings for `heic-decode` (no upstream types). Loaded lazily by
 * src/lib/imageNormalize.ts only when a browser can't decode HEIC natively.
 */
declare module "heic-decode" {
  export type DecodedHeic = {
    width: number;
    height: number;
    /** RGBA, row-major, width * height * 4 bytes. */
    data: Uint8ClampedArray;
  };
  function decode(input: { buffer: ArrayBuffer | Uint8Array }): Promise<DecodedHeic>;
  export default decode;
}
