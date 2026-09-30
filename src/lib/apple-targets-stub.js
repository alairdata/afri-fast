// Web stand-in for @bacons/apple-targets (widgets only exist on iOS).
export class ExtensionStorage {
  constructor() {}
  static reloadWidget() {}
  static reloadControls() {}
  set() {}
  get() { return null; }
  remove() {}
}
