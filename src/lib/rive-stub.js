// Web stand-in for rive-react-native (native only). The gauge uses its drawn fallback on web.
const Rive = () => null;
export const useRive = () => [() => {}, null];
export const useRiveNumber = () => [undefined, () => {}];
export const AutoBind = (value) => ({ type: 'autobind', value });
export const Fit = { Contain: 'contain' };
export const Alignment = { Center: 'center' };
export default Rive;
