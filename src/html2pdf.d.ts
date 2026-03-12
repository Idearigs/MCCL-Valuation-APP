declare module 'html2pdf.js' {
  function html2pdf(): {
    set(opts: object): ReturnType<typeof html2pdf>;
    from(el: HTMLElement): ReturnType<typeof html2pdf>;
    save(): Promise<void>;
  };
  export default html2pdf;
}
