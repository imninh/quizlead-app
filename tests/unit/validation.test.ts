import { describe, it, expect } from 'vitest'
import {
  validateQuestion,
  validateQuiz,
  normalizeName,
  validateName,
  normalizePhone,
  validatePhone,
  maskPhone,
} from '../../src/domain/validation'

describe('validation question', () => {
  it('empty text invalid', () => {
    const e = validateQuestion({ text: '', options: ['a', 'b', 'c', 'd'], correctIndex: 0 })
    expect(e.text).toBeDefined()
  })
  it('too short invalid', () => {
    const e = validateQuestion({ text: 'ab', options: ['a', 'b', 'c', 'd'], correctIndex: 0 })
    expect(e.text).toBeDefined()
  })
  it('too long invalid', () => {
    const e = validateQuestion({ text: 'a'.repeat(301), options: ['a', 'b', 'c', 'd'], correctIndex: 0 })
    expect(e.text).toBeDefined()
  })
  it('empty option invalid', () => {
    const e = validateQuestion({ text: 'hello world', options: ['', 'b', 'c', 'd'], correctIndex: 0 })
    expect(e.options).toBeDefined()
  })
  it('duplicate options case-insensitive invalid', () => {
    const e = validateQuestion({ text: 'hello world', options: ['Hà Nội', ' hà nội ', 'c', 'd'], correctIndex: 0 })
    expect(e.options).toBeDefined()
  })
  it('missing correctIndex invalid', () => {
    const e = validateQuestion({ text: 'hello world', options: ['a', 'b', 'c', 'd'], correctIndex: null })
    expect(e.correctIndex).toBeDefined()
  })
  it('valid question no errors', () => {
    const e = validateQuestion({ text: 'hello world', options: ['a', 'b', 'c', 'd'], correctIndex: 0 })
    expect(Object.keys(e).length).toBe(0)
  })
})

describe('validation quiz', () => {
  it('4 questions rejected', () => {
    const e = validateQuiz({ title: 'abc', questions: Array(4).fill({ text: 'hello world', options: ['a', 'b', 'c', 'd'], correctIndex: 0 }) })
    expect(Object.keys(e).length).toBeGreaterThan(0)
  })
  it('short title rejected', () => {
    const e = validateQuiz({ title: 'ab', questions: Array(5).fill({ text: 'hello world', options: ['a', 'b', 'c', 'd'], correctIndex: 0 }) })
    expect(e.title).toBeDefined()
  })
  it('valid quiz no errors', () => {
    const e = validateQuiz({ title: 'abc quiz', questions: Array(5).fill({ text: 'hello world', options: ['a', 'b', 'c', 'd'], correctIndex: 0 }) })
    expect(Object.keys(e).length).toBe(0)
  })
})

describe('name', () => {
  it('normalizes', () => expect(normalizeName('  Nguyễn   Văn A ')).toBe('Nguyễn Văn A'))
  it('accepts NFD name and returns NFC', () => {
    const nfd = 'Nguyễn Văn A'.normalize('NFD')
    expect(validateName(nfd)).toBe(true)
    expect(normalizeName(nfd)).toBe('Nguyễn Văn A'.normalize('NFC'))
  })
  it('valid name', () => expect(validateName('Nguyễn Văn A')).toBe(true))
  it('too short', () => expect(validateName('A')).toBe(false))
  it('digits invalid', () => expect(validateName('abc123')).toBe(false))
  it('script invalid', () => expect(validateName('<script>')).toBe(false))
})

describe('phone', () => {
  it('normalizes spaces', () => expect(normalizePhone('0912 345 678')).toBe('0912345678'))
  it('normalizes +84', () => expect(normalizePhone('+84912345678')).toBe('0912345678'))
  it('normalizes 84-', () => expect(normalizePhone('84-912-345-678')).toBe('0912345678'))
  it('normalizes parentheses (+84)', () => expect(normalizePhone('(+84) 912 345 678')).toBe('0912345678'))
  it('normalizes dots', () => expect(normalizePhone('0912.345.678')).toBe('0912345678'))
  it('invalid prefix', () => expect(validatePhone('0212345678')).toBe(false))
  it('too short', () => expect(validatePhone('091234567')).toBe(false))
  it('non-numeric', () => expect(validatePhone('abc')).toBe(false))
  it('valid', () => expect(validatePhone('0912345678')).toBe(true))
  it('mask', () => expect(maskPhone('0912345678')).toBe('09******78'))
})
