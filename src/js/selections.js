import isEqual from 'deep-equal';
import _ from 'lodash';
// helpers
import * as stringUtils from './utils/string';

/**
 * @description - Splice string into array of ranges, flagging what is selected
 * @param {array} ranges - array of ranges [[int,int],...]
 * @returns {array} - array of objects [obj,...]
 */
export const spliceStringOnRanges = (string, ranges) => {
  var selectionArray = []; // response
  var remainingString = string;
  // shift the range since the loop is destructive by working on the remainingString and not original string
  var rangeShift = 0; // start the range shift at the first character
  ranges.forEach(function (range) {
    const firstCharacterPosition = range[0] - rangeShift; // original range start - the rangeShift
    const beforeSelection = remainingString.slice(0, firstCharacterPosition); // save all the text before the selection
    if (beforeSelection) { // only add to the array if string isn't empty
      selectionArray.push({ text: beforeSelection, selected: false });
    }
    const shiftedRangeStart = range[0] - rangeShift; // range start - the rangeShift
    const shiftedRangeEnd = range[1] + 1 - rangeShift; // range end - rangeShift + 1 to include last character
    const selection = remainingString.slice(shiftedRangeStart, shiftedRangeEnd); // save the text in the selection
    const stringBeforeRange = string.slice(0, range[0]);
    const occurrence = stringUtils.occurrencesInString(stringBeforeRange, selection) + 1;
    const occurrences = stringUtils.occurrencesInString(string, selection);
    const selectionObject = {
      text: selection,
      selected: true,
      occurrence: occurrence,
      occurrences: occurrences
    };
    selectionArray.push(selectionObject); // add the selection to the response array
    // next iteration is using remaining string
    const lastCharacterPosition = range[1] - rangeShift + 1; // original range end position - the rangeShift + 1 to not include the last range character in the remaining string
    remainingString = remainingString.slice(lastCharacterPosition); // update the remainingString to after the range
    // shift the range up to last char of substring (before+sub)
    rangeShift += beforeSelection.length; // adjust the rangeShift by the length prior to the selection
    rangeShift += selection.length; // adjust the rangeShift by the length of the selection itself
  });
  if (remainingString) { // only add to the array if string isn't empty
    selectionArray.push({ text: remainingString, selected: false });
  }
  return selectionArray;
};

/**
 * @description - This converts ranges to array of selection objects
 * @param {string} string - text used to get the ranges of
 * @param {array} selections - array of selections [obj,...]
 * @returns {array} - array of range objects
 */
export const selectionsToRanges = (string, selections) => {
  var ranges = []; // response
  selections.forEach(selection => {
    if (string && string.includes(selection.text)) { // conditions to prevent errors
      const splitArray = string.split(selection.text); // split the string to get the text between occurrences
      const beforeSelection = splitArray.slice(0, selection.occurrence).join(selection.text); // get the text before the selection to handle multiple occurrences
      const start = beforeSelection.length; // the start position happens at the length of the string that comes before it
      const end = start + selection.text.length - 1; // the end position happens at the end of the selection text, but length doesn't account for 0 based position start
      const range = [start, end]; // new range
      ranges.push(range); // add the new range
    }
  });
  return ranges;
};

/**
 * @description - Splice string into array of substrings, flagging what is selected
 * @param {string} string - text used to get the ranges of
 * @param {array} selections - array of selections [obj,...]
 * @returns {array} - array of objects
 */
export const selectionsToStringSplices = (string, selections) => {
  var splicedStringArray = []; // response
  selections = optimizeSelections(string, selections); // optimize them before converting
  const ranges = selectionsToRanges(string, selections); // convert the selections to ranges
  splicedStringArray = spliceStringOnRanges(string, ranges); // splice the string on the ranges
  return splicedStringArray; // return the spliced string
};

/**
 * @description - This abstracts complex handling of ranges such as order, deduping, concatenating, overlaps
 * @param {array}  ranges - array of ranges [[int,int],...]
 * @returns {array} - array of optimized ranges [[int,int],...]
 */
export const optimizeRanges = (ranges) => {
  let optimizedRanges = []; // response
  if (ranges.length === 1) return ranges; // if there's only one, return it
  ranges = _.sortBy(ranges, function (range) { return range[1] }); // order ranges by end char index as secondary
  ranges = _.sortBy(ranges, function (range) { return range[0] }); // order ranges by start char index as primary
  ranges = _.uniq(ranges); // remove duplicates
  // combine overlapping and contiguous ranges
  let runningRange = []; // the running range to merge overlapping and contiguous ranges
  ranges.forEach((currentRange, index) => {
    const currentStart = currentRange[0], currentEnd = currentRange[1];
    let runningStart = runningRange[0], runningEnd = runningRange[1];
    if (currentStart >= runningStart && currentStart <= runningEnd + 1) { // the start occurs in the running range and +1 handles contiguous
      if (currentEnd >= runningStart && currentEnd <= runningEnd) { // if the start occurs inside running range then let's check the end
        // if the end occurs inside the running range then it's inside it and doesn't matter
      } else { // the end doesn't occur inside the running range
        runningRange[1] = runningEnd = currentEnd; // extend running range
      }
    } else { // the start does not occur in the running range
      if (runningRange.length !== 0) optimizedRanges.push(runningRange); // the running range is closed push it to optimizedRanges
      runningRange = currentRange; // reset the running range to this one
    }
    if (ranges.length === index + 1 && runningEnd - runningStart >= 0) { // this is the last one and it isn't blank
      optimizedRanges.push(runningRange); // push the last one to optimizedRanges
    }
  });
  return optimizedRanges;
};

/**
 * @description - This converts ranges to array of selection objects
 * @param {string} string - text used to get the ranges of
 * @param {array} ranges - array of ranges [[int,int],...]
 * @returns {array} - array of selection objects
 */
export const rangesToSelections = (string, ranges) => {
  let selections = [];
  ranges.forEach(range => {
    const start = range[0], end = range[1]; // set the start and end point
    const length = end - start + 1; // get the length of the sub string
    const subString = string.substr(start, length); // get text of the sub string
    const beforeText = string.substr(0, start); // get the string prior to the range
    const beforeMatches = stringUtils.occurrencesInString(beforeText, subString); // get occurrences prior to range
    const occurrence = beforeMatches + 1; // get number of this occurrence
    const occurrences = stringUtils.occurrencesInString(string, subString); // get occurrences in string
    const selection = {
      text: subString,
      occurrence: occurrence,
      occurrences: occurrences
    };
    if (occurrences > 0) { // there are some edge cases where empty strings get through but don't have occurrences
      selections.push(selection);
    }
  });
  return selections;
};

/**
 * @description - This abstracts complex handling of selections such as order, deduping, concatenating, overlapping ranges
 * @param {string} string - the text selections are found in
 * @param {array}  selections - array of selection objects [Obj,...]
 * @returns {array} - array of selection objects
 */
export const optimizeSelections = (string, selections) => {
  let optimizedSelections; // return
  // filter out the random clicks from the UI
  selections = selections.filter( selection => {
    const blankSelection = { text: "", occurrence: 1, occurrences: 0 };
    return !isEqual(selection, blankSelection);
  });
  var ranges = selectionsToRanges(string, selections); // get char ranges of each selection
  ranges = optimizeRanges(ranges); // optimize the ranges
  optimizedSelections = rangesToSelections(string, ranges); // convert optimized ranges into selections
  return optimizedSelections;
};
/**
 * @description - Removes a selection if found in the array of selections
 * @param {Object} selection - the selection to remove
 * @param {Array}  selections - array of selection objects [Obj,...]
 * @param {string} string - the text selections are found in
 * @returns {Array} - array of selection objects
 */
export const removeSelectionFromSelections = (selection, selections, string) => {
  selections = Array.from(selections);
  selections = selections.filter(_selection =>
    !(_selection.occurrence === selection.occurrence && _selection.text === selection.text)
  );
  selections = optimizeSelections(string, selections);
  return selections;
};
/**
 * @description - Removes a selection if found in the array of selections
 * @param {Object} selection - the selection to remove
 * @param {Array}  selections - array of selection objects [Obj,...]
 * @param {string} string - the text selections are found in
 * @returns {Array} - array of selection objects
 */
export const addSelectionToSelections = (selection, selections, string) => {
  selections = Array.from(selections);
  selections.push(selection);
  selections = optimizeSelections(string, selections);
  return selections;
};

/**
 * 
 * @param {string} string - Entire string to search within 'Blessed be the name of the Lord'
 * @param {string} subString - substring to search for inside of entire string i.e. 'bless, blessed, blessing'
 * @return {number}
 */
export const getQuoteOccurrencesInVerse = (string, subString) => {
  let n = 0;
  if (subString.length <= 0) return 0;
  if (subString.split(',').length > 1) {
    let stringArray = subString.split(',');
    stringArray.forEach((element) => {
      n += getQuoteOccurrencesInVerse(string, element.trim());
    });
    return n;
  } else {
    if (subString.includes('...')) subString = subString.replace('...', '.*');
    const regex = new RegExp(`\\W+${subString}\\W+`,'g');
    let matchedSubstring;
    while ((matchedSubstring = regex.exec(string)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matchedSubstring
      if (matchedSubstring.index === regex.lastIndex) {
        regex.lastIndex++;
      }
      n++;
    }
    return n;
  }
};

 /**
  * @description Function that count occurrences of a substring in a string
  * @param {String} string - The string to search in
  * @param {String} subString - The sub string to search for
  * @returns {Integer} - the count of the occurrences
  * @see http://stackoverflow.com/questions/4009756/how-to-count-string-occurrence-in-string/7924240#7924240
  * modified to fit our use cases, return zero for '' substring, and no use case for overlapping.
  */
export const occurrences = (string, subString) => {
  if (subString.length <= 0) return 0;
  let n = 0, pos = 0, step = subString.length;
// eslint-disable-next-line no-constant-condition
  while (true) {
    pos = string.indexOf(subString, pos);
    if (pos === -1) break;
    ++n;
    pos += step;
  }
  return n;
};

/**
 * @description This checks to see if the string still has the same number of occurrences.
 * It should remove the selections that the occurrences do not match
 * @param {string} string - the text selections are found in
 * @param {array}  selections - array of selection objects [Obj,...]
 * @returns {array} - array of selection objects
 */
export const checkSelectionOccurrences = (string, selections) => {
  selections = selections.filter(selection => {
    let count = occurrences(string, selection.text);
    return count === selection.occurrences;
  });
  return selections;
};

/**
 * @description - Gets the selection object from the currently selected text from the Web UI
 * @param {String} entireText - the text that the selection should be in, ie verseText
 * @return {Object} - the selection object to be used
 * TODO: Find a way to test
 */
export const getSelectionFromCurrentWindowSelection = (entireText) => {
  let selection; // response
  const windowSelection = getCurrentWindowSelection();
  const selectedText = getSelectedTextFromWindowSelection(windowSelection);
  const prescedingText = getPrescedingTextFromWindowSelection(windowSelection);
  // Some edge cases leave a weird selection remaining, let's clean up.
  selection = stringUtils.generateSelection(selectedText, prescedingText, entireText);
  window.getSelection().empty();
  return selection;
};

/**
* @description - Gets the window's Selection from the UI
* @return {Object} windowSelection - a windowSelection object from inside a compatible element
* TODO: Find a way to test
*/
export const getCurrentWindowSelection = () => window.getSelection();

/**
* @description - Gets the window selected text from the windowSelection
* @param {Object} windowSelection - a windowSelection object from inside a compatible element
* @return {String} - selectedText
* TODO: Find a way to test
*/
export const getSelectedTextFromWindowSelection = (windowSelection) => windowSelection.toString();

/**
* @description - Gets the prescedingText from the windowSelection
* @param {Object} windowSelection - a windowSelection object from inside a compatible element
* @return {String} - the string of prescedingText
* Implementation notes on why you can't just use the window.getSelection()
* getSelection is limited by same innerText node, and does not include span siblings
* indexOfTextSelection is broken by any other previous selection since it only knows its innerText node.
* TODO: Find a way to test
*/
export const getPrescedingTextFromWindowSelection = (windowSelection) => {
  let prescedingText; // response
  // concatenate spans etc... to get the prescedingText from the windowSelection
  const selectedText = getSelectedTextFromWindowSelection(windowSelection);
  // do nothing since an empty space was selected
  if (selectedText !== '') {
    // get the text after the presceding selection and current span selection is in.
    const selectionRange = windowSelection.getRangeAt(0);
    // get the character index of what is selected in context of the span it is in.
    const selectionRangeStart = selectionRange.startOffset;
    // get the container of the selection, this is a strange object, that logs as a string.
    const textContainer = selectionRange.commonAncestorContainer;
    // get the parent span that contains the textContainer.

    let element;
    // if the textContainer is #text, then use the parentElement - usually non-overlapping selection
    if ('#text' === textContainer.nodeName) element = textContainer.parentElement;
    // if the textContainer is a span, then use it as the element
    if ('SPAN' === textContainer.nodeName) element = textContainer;
    // if the textContainer is a div, its an overlapping selection, don't use commonAncestorContainer
    if ('DIV' === textContainer.nodeName) element = selectionRange.startContainer.parentElement;
    // check for element, as textContainer can but rarely be something other than #text, span or div
    if (element) {
      prescedingText = getPrescedingTextFromElementAndSiblings(element, selectionRangeStart, windowSelection);
    }
  }
  return prescedingText;
};

/**
 * @description - gets the prescedingText from the element ending at the selectionRangeStart
 * @param {Element} element - the html element that has text and siblings with text
 * @param {Int} selectionRangeStart - the character index of the start of the selection
 * @return {String} - the string of prescedingText
 */
export const getPrescedingTextFromElementAndSiblings = (element, selectionRangeStart, windowSelection) => {
  let prescedingText; // response
  const prescedingTextFromElementSiblings = getPrescedingTextFromElementSiblings(element, windowSelection);
  const prescedingTextFromElement = getPrescedingTextFromElement(element, selectionRangeStart, windowSelection);
  prescedingText = prescedingTextFromElementSiblings + prescedingTextFromElement;
  return prescedingText;
};

/**
 * @description - gets the prescedingText from the element ending at the selectionRangeStart
 * @param {Element} element - the html element that has text
 * @param {Int} selectionRangeStart - the character index of the start of the selection
 * @return {String} - the string of prescedingText
 */
export const getPrescedingTextFromElement = (element, selectionRangeStart) => {
  let prescedingText; // response
  const text = element.textContent;
  prescedingText = text.slice(0, selectionRangeStart);
  return prescedingText;
};

/**
 * @description - gets the prescedingText from the element siblings
 * @param {Element} element - the html element that has text and siblings with text
 * @return {String} - the string of prescedingText
 */
export const getPrescedingTextFromElementSiblings = (element, windowSelection) => {
  let prescedingText = ''; // response
  // get the previous sibling to start the loop
  let previousSibling = element.previousElementSibling;
  // loop through previous spans to get their text
  while (previousSibling) {
    // just in case the previousSibling just happens to be a part of the selection
    if (windowSelection && !windowSelection.containsNode(previousSibling)) {
      // prepend the spans innerText to the prescedingText
      prescedingText = previousSibling.textContent + prescedingText;
    }
    // move to the previous span, if none, it ends the loop
    previousSibling = previousSibling.previousElementSibling;
  }
  return prescedingText;
};

/**
 * This is a helper method to determine if the selection needs an ellipsis in
 * between the selected words or not.
 * @param {Array} selections - Array of word objects that the user selected
 * @param {string} verseText - The entire verse string from the current check
 * @returns {boolean} - Whether or not the View should display an ellipsis
 */
export function shouldRenderEllipsis(selections, verseText) {
  /** Need to get the the words and occurrence of the selected edge words */
  const endSelectedWord = selections[selections.length - 1].text.trim();
  const endSelectedWordOccurrence = selections[selections.length - 1].occurrence;
  const beginningSelectedWord = selections[0].text.trim();
  const beginningSelectedWordOccurrence = selections[0].occurrence;

  /** Using the occurrences to get the actual index of the word vs
   *  the first time it appears in verse text */
  const indexOfBeginningSelection = verseText.split(beginningSelectedWord, beginningSelectedWordOccurrence).join(beginningSelectedWord).length;
  const indexOfEndSelection = verseText.split(endSelectedWord, endSelectedWordOccurrence).join(endSelectedWord).length;

  /** Checking the text in between selected words for a non space character */
  const textBetweenSelection = verseText.substring(indexOfBeginningSelection + beginningSelectedWord.length, indexOfEndSelection);
  /** If the end index is the same as the beginning then it is the first word */
  return (indexOfEndSelection !== indexOfBeginningSelection) && textBetweenSelection.match(/\S/);
}

/**
 * @description - generates a selection object from the selected text, prescedingText and whole text
 * @param {String} selectedText - the text that is selected
 * @param {String} prescedingText - the text that prescedes the selection
 * @param {String} entireText - the text that the selection should be in
 * @return {Object} - the selection object to be used
 */
export const generateSelection = (selectedText, prescedingText, entireText) => {
  let selection = {}; // response
  // replace more than one contiguous space with a single one since HTML/selection only renders 1
  entireText = stringUtils.normalizeString(entireText);
  // get the occurrences before this one
  let prescedingOccurrences = stringUtils.occurrencesInString(prescedingText, selectedText);
  // calculate this occurrence number by adding it to the presceding ones
  let occurrence = prescedingOccurrences + 1;
  // get the total occurrences from the verse
  let occurrences = stringUtils.occurrencesInString(entireText, selectedText);
  selection = {
    text: selectedText,
    occurrence: occurrence,
    occurrences: occurrences
  };
  return selection;
};
