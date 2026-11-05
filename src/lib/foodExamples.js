// Example foods for the Describe a meal screen, from the person's own part of the world, so it never
// reads as an app for only one or two countries.
const EAST = new Set(['Kenya', 'Tanzania', 'Rwanda', 'Burundi', 'South Sudan']);
const HORN = new Set(['Ethiopia', 'Eritrea']);
const SOUTHERN = new Set(['South Africa', 'Zimbabwe', 'Zambia', 'Malawi', 'Botswana', 'Namibia', 'Mozambique', 'Lesotho', 'Eswatini']);
const NORTH = new Set(['Egypt', 'Morocco', 'Algeria', 'Tunisia', 'Libya', 'Sudan']);
const WEST = new Set(['Nigeria', 'Ghana', 'Benin', 'Togo', 'Sierra Leone', 'Liberia', 'Gambia', 'Senegal', 'Ivory Coast', 'Niger', 'Burkina Faso', 'Guinea', 'Guinea-Bissau', 'Mali', 'Cameroon']);

const EXAMPLES = {
  uganda: { sentence: 'Matoke with groundnut sauce and a piece of beef, plus a cup of tea', chips: ['Matoke + groundnut sauce', 'Posho + beans', 'Rolex', 'Luwombo', 'Chapati'] },
  east: { sentence: 'Ugali with sukuma wiki and beef stew, plus a cup of chai', chips: ['Ugali + sukuma wiki', 'Pilau', 'Chapati + beans', 'Nyama choma', 'Githeri'] },
  horn: { sentence: 'Injera with doro wat and a boiled egg, plus a cup of coffee', chips: ['Injera + shiro', 'Doro wat', 'Tibs', 'Firfir', 'Kitfo'] },
  southern: { sentence: 'Pap with chakalaka and grilled chicken, plus a glass of water', chips: ['Pap + chakalaka', 'Sadza + greens', 'Nsima + fish', 'Braai meat', 'Samp + beans'] },
  north: { sentence: 'Couscous with vegetables and chicken, plus a glass of mint tea', chips: ['Couscous + chicken', 'Koshari', 'Tagine', 'Ful medames', 'Falafel'] },
  west: { sentence: 'Two wraps of fufu with light soup and fish, plus a bottle of water', chips: ['Jollof rice', 'Fufu + soup', 'Waakye', 'Eba + egusi', 'Suya'] },
  anywhere: { sentence: 'Rice with chicken stew and vegetables, plus a glass of water', chips: ['Rice + stew', 'Ugali + sukuma wiki', 'Jollof rice', 'Injera + shiro', 'Eggs + toast'] },
};

export function foodExamplesFor(country) {
  if (country === 'Uganda') return EXAMPLES.uganda;
  if (EAST.has(country)) return EXAMPLES.east;
  if (HORN.has(country)) return EXAMPLES.horn;
  if (SOUTHERN.has(country)) return EXAMPLES.southern;
  if (NORTH.has(country)) return EXAMPLES.north;
  if (WEST.has(country)) return EXAMPLES.west;
  return EXAMPLES.anywhere;
}
