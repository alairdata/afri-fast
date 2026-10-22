import { Alert, Platform } from 'react-native';

// Alert.alert shows nothing on the web (react-native-web leaves it empty), so messages and confirm
// buttons silently did nothing there. On phones this is exactly Alert.alert; on the web a message uses the
// browser's alert box, and "Cancel + one action" uses its OK/Cancel box (OK runs the action).
export function showAlert(title, message, buttons) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    Alert.alert(title, message, buttons);
    return;
  }
  const text = [title, message].filter(Boolean).join('\n\n');
  const list = Array.isArray(buttons) ? buttons : [];
  const cancel = list.find((b) => b.style === 'cancel');
  const actions = list.filter((b) => b !== cancel);
  if (actions.length === 0 || (actions.length === 1 && !cancel)) {
    window.alert(text);
    (actions[0] || cancel)?.onPress?.();
    return;
  }
  const action = actions[0];
  const ok = window.confirm(`${text}\n\nOK: ${action.text}${cancel ? `\nCancel: ${cancel.text}` : ''}`);
  if (ok) action.onPress?.();
  else cancel?.onPress?.();
}
