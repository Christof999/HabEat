import { describe, expect, it } from 'vitest'
import {
  calculateCarbUnits,
  getAdjustedCarbs,
  getPortionFactor,
  hasDiabetesType1,
  hasDiabetesType2,
} from './diabetes'

describe('diabetes utilities', () => {
  it('erkennt Diabetes Typ 1 zuverlässig', () => {
    expect(hasDiabetesType1(['Diabetes Typ 1'])).toBe(true)
    expect(hasDiabetesType1(['type 1 diabetes'])).toBe(true)
    expect(hasDiabetesType1(['T1D'])).toBe(true)
    expect(hasDiabetesType1(['Diabetes Typ 2'])).toBe(false)
  })

  it('erkennt Diabetes Typ 2 zuverlässig', () => {
    expect(hasDiabetesType2(['Diabetes Typ 2'])).toBe(true)
    expect(hasDiabetesType2(['type 2 diabetes'])).toBe(true)
    expect(hasDiabetesType2(['T2D'])).toBe(true)
    expect(hasDiabetesType2(['Diabetes Typ 1'])).toBe(false)
  })

  it('liefert passende Portionsfaktoren', () => {
    expect(getPortionFactor('full')).toBe(1)
    expect(getPortionFactor('half')).toBe(0.5)
    expect(getPortionFactor('some')).toBe(0.25)
    expect(getPortionFactor(undefined)).toBe(1)
  })

  it('berechnet angepasste Kohlenhydrate nach Portion', () => {
    expect(getAdjustedCarbs(24, 'full')).toBe(24)
    expect(getAdjustedCarbs(24, 'half')).toBe(12)
    expect(getAdjustedCarbs(24, 'some')).toBe(6)
    expect(getAdjustedCarbs(null, 'full')).toBe(null)
  })

  it('berechnet BE/KE aus Kohlenhydraten', () => {
    const units = calculateCarbUnits(24)
    expect(units.carbs).toBe(24)
    expect(units.be).toBe(2)
    expect(units.ke).toBe(2.4)
  })
})
