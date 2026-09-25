// One-tap water logging on the Today tab adds a sensible single serving in whichever unit the user
// tracks water in: about a glass (250 mL / 8 oz), or one sachet / bottle / glass.
const INCREMENT = { oz: 8, mL: 250, sachet: 1, bottle: 1 };
const UNIT_WORD = { oz: 'oz', mL: 'mL', sachet: 'sachet', bottle: 'bottle' };

export const quickWaterIncrement = (unit) => INCREMENT[unit] ?? 1;

export const quickWaterLabel = (unit) => `${quickWaterIncrement(unit)} ${UNIT_WORD[unit] || 'glass'}`;
