import { Element, load } from "cheerio";

export const parseJson = (text: string) => {
    return JSON.parse(text.substring(1));
};

export const replaceMultipleSpacesWithOneSpace = (str: string) => {
    return str.replace(/\s+/g, ' ');
};

export const parseString = (str: string) => {
    return replaceMultipleSpacesWithOneSpace(str).trim();
};

export const getString = (html: string) => {
    const $ = load(`<div id="content">${html}</div>`);
    let string = "";
    $("#content").contents().each((_, element) => {
        if (element.type === 'text') {
            string += parseString($(element).text());
        } else if (element.type === 'tag') {
            if (element.name === 'br') {
                string += '\n';
            } else {
                string += getString($(element).html() || '');
            }
        }
    });
    return string;
};