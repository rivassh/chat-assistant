import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectLanguage,
  languageInstruction,
  isDefectiveAnswer,
  isTruncated,
} from '../src/lib/ai.js';

describe('detectLanguage', () => {
  test('Persian', () => {
    assert.equal(detectLanguage('سلام چطوری؟'), 'fa');
    assert.equal(detectLanguage('متن فارسی'), 'fa');
  });

  test('Arabic', () => {
    assert.equal(detectLanguage('مرحبا كيف حالك؟'), 'ar');
    assert.equal(detectLanguage('نص عربي'), 'ar');
  });

  test('English', () => {
    assert.equal(detectLanguage('Hello world'), 'en');
    assert.equal(detectLanguage('How are you?'), 'en');
  });

  test('empty string defaults to English', () => {
    assert.equal(detectLanguage(''), 'en');
  });
});

describe('languageInstruction', () => {
  test('Persian', () => {
    const instr = languageInstruction('سلام چطوری؟');
    assert.ok(instr.includes('Persian'));
  });

  test('Arabic', () => {
    const instr = languageInstruction('مرحبا كيف حالك');
    assert.ok(instr.includes('Arabic'));
  });

  test('English', () => {
    const instr = languageInstruction('Hello');
    assert.ok(instr.includes('English'));
  });
});

describe('isDefectiveAnswer', () => {
  test('reasoning opener', () => {
    assert.equal(
      isDefectiveAnswer("Here's a thinking process:\n1. Analyze", 'Hello'),
      true
    );
  });

  test('safety tag', () => {
    assert.equal(isDefectiveAnswer('User Safety: safe', 'Hello'), true);
  });

  test('empty text is defective', () => {
    assert.equal(isDefectiveAnswer('', 'Hello'), true);
  });

  test('valid Persian answer for Persian question', () => {
    assert.equal(
      isDefectiveAnswer('سلام! من می‌توانم کمکتان کنم.', 'سلام چطوری'),
      false
    );
  });

  test('valid English answer for English question', () => {
    assert.equal(isDefectiveAnswer('Hello! I can help you.', 'How are you?'), false);
  });
});

describe('isTruncated', () => {
  test('short text returns false', () => {
    assert.equal(isTruncated('short'), false);
  });

  test('text with terminator returns false', () => {
    assert.equal(isTruncated('Complete sentence.'), false);
    assert.equal(isTruncated('این جمله کامل است.'), false);
  });

  test('long text without terminator returns true', () => {
    assert.equal(isTruncated('a'.repeat(100)), true);
  });

  test('Persian text without terminator returns true', () => {
    assert.equal(isTruncated('این یک جمله طولانی است بدون پایگاه و با حروف طول و کلمات متنوع است که بیش از بیست حرف می‌باشد'), true);
  });
});