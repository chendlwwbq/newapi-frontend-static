import { readFileSync } from 'node:fs'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, expect, it } from 'vitest'

const stylesheet = readFileSync('src/styles/globals.css', 'utf8')
let window: Window

beforeEach(() => {
  window = new Window({ width: 375, height: 812 })
  const style = window.document.createElement('style')
  // DOM emulation has no pointer hover. An attribute has the same specificity
  // as :hover, so this exercises the real cascade with that state activated.
  style.textContent = stylesheet.replace(/@import[^;]+;/g, '').replace(/:hover/g, '[data-hover]')
  window.document.head.append(style)
})

afterEach(async () => {
  await window.happyDOM.close()
})

it.each(['class="password-field"', 'data-slot="password-field"'])('reserves text space for the mobile reveal target and inset in %s', (wrapper) => {
  window.document.body.innerHTML = `<div ${wrapper}><input type="password"><button>Show password</button></div>`
  const input = window.document.querySelector('input')!
  const button = window.document.querySelector('button')!
  const targetWidth = Number.parseFloat(window.getComputedStyle(button).minWidth)
  expect(targetWidth).toBeGreaterThanOrEqual(44)
  expect(Number.parseFloat(window.getComputedStyle(input).paddingRight)).toBeGreaterThanOrEqual(targetWidth + 10 + 4)
  input.type = 'text'
  expect(Number.parseFloat(window.getComputedStyle(input).paddingRight)).toBeGreaterThanOrEqual(targetWidth + 10 + 4)
})

it.each(['light', 'dark'])('keeps sticky actions opaque when the row is hovered in %s mode', (theme) => {
  window.document.documentElement.dataset.theme = theme
  window.document.body.innerHTML =
    '<table class="data-table" style="--card: rgb(24, 28, 32); --muted: rgb(80, 80, 80)"><tbody><tr data-hover><td>Long content scrolling underneath</td><td class="table-sticky-action">Edit</td></tr></tbody></table>'
  const action = window.document.querySelector('.table-sticky-action')!
  expect(window.getComputedStyle(action).backgroundColor).toBe('rgb(24, 28, 32)')
  expect(window.getComputedStyle(action).position).toBe('sticky')
})
