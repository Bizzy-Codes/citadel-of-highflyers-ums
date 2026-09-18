// mammoth ships a prebuilt browser bundle but types only for its Node
// entry point, so the browser path needs declaring by hand.
declare module 'mammoth/mammoth.browser.js' {
  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: unknown[] }>;
}
