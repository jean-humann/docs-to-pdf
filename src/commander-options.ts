import * as puppeteer from 'puppeteer-core';

export function commaSeparatedList(value: string): Array<string> {
  return value.split(',');
}

export function generatePuppeteerPDFMargin(
  value: string,
): puppeteer.PDFOptions['margin'] {
  const marginStrings = commaSeparatedList(value);

  const marginTop = marginStrings[0];
  const marginRight = marginStrings[1];
  const marginBottom = marginStrings[2];
  const marginLeft = marginStrings[3];

  const generatedMargins = {
    top: marginTop,
    right: marginRight,
    bottom: marginBottom,
    left: marginLeft,
  };

  return generatedMargins;
}
