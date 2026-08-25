import { describe, expect, it } from 'vitest'
import { titlebarContentStyle, titlebarHeaderClass, titlebarInnerClass } from './titlebar-layout'

describe('titlebarContentStyle', () => {
  it('leaves macOS to CSS padding around the traffic lights', () => {
    expect(titlebarContentStyle(true)).toBeUndefined()
    expect(titlebarHeaderClass(true)).toBe('px-4')
    expect(titlebarInnerClass(true)).toBe('w-full pl-16')
  })

  it('sizes the content to the overlay area on Windows/Linux', () => {
    expect(titlebarContentStyle(false)).toEqual({
      width: 'env(titlebar-area-width, 100%)',
      marginLeft: 'env(titlebar-area-x, 0px)'
    })
    expect(titlebarHeaderClass(false)).toBe('')
    expect(titlebarInnerClass(false)).toBe('pl-4 pr-2')
  })
})
