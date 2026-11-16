// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const stylesheet = readFileSync('src/styles/home.css', 'utf8')

describe('home tool icon contrast', () => {
  let style: HTMLStyleElement
  let fixture: HTMLElement

  beforeEach(() => {
    style = document.createElement('style')
    style.textContent = stylesheet
    document.head.append(style)

    fixture = document.createElement('main')
    fixture.className = 'home-page'
    fixture.innerHTML = '<div class="tools-grid"><img src="/orbis/home/cursor.svg"><img src="/orbis/home/claudecode-color.svg"></div>'
    document.body.append(fixture)
  })

  afterEach(() => {
    delete document.documentElement.dataset.theme
    fixture.remove()
    style.remove()
  })

  it('darkens pale monochrome icons in the light theme', () => {
    const [monochrome, colorful] = fixture.querySelectorAll('img')

    expect(getComputedStyle(monochrome).filter).toMatch(/^brightness\(/)
    expect(getComputedStyle(colorful).filter || 'none').toBe('none')
  })

  it('keeps pale monochrome icons bright in the dark theme', () => {
    document.documentElement.dataset.theme = 'dark'
    const monochrome = fixture.querySelector('img')!

    expect(getComputedStyle(monochrome).filter || 'none').toBe('none')
  })
})
